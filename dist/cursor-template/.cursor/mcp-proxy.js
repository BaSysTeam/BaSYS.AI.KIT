#!/usr/bin/env node
/**
 * BaSYS MCP stdio→HTTPS прокси.
 *
 * Читает JSON-RPC сообщения из stdin, пробрасывает их на HTTP MCP-эндпоинт
 * BaSYS с актуальным JWT-токеном и возвращает ответы в stdout.
 * Токен запрашивается автоматически при старте и обновляется за 1 минуту
 * до истечения или при получении 401.
 *
 * Конфигурация: .cursor/basys-credentials.json
 */
'use strict';

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const rl    = require('readline');

// ─── конфигурация ──────────────────────────────────────────────────

const CREDS_FILE            = path.join(__dirname, 'basys-credentials.json');
const REFRESH_BEFORE_MS     = 60_000; // обновить токен за 60 с до истечения

// ─── состояние токена ──────────────────────────────────────────────

let currentToken    = null;
let tokenExpiresAt  = 0;

// ─── логирование ───────────────────────────────────────────────────

function log(msg) {
  process.stderr.write(`[mcp-proxy] ${msg}\n`);
}

// ─── загрузка учётных данных ───────────────────────────────────────

function loadCredentials() {
  if (!fs.existsSync(CREDS_FILE)) {
    log(`Файл учётных данных не найден: ${CREDS_FILE}`);
    log('Создайте .cursor/basys-credentials.json по образцу .cursor/basys-credentials.example.json');
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));
  } catch (e) {
    log(`Не удалось прочитать файл учётных данных: ${e.message}`);
    process.exit(1);
  }
}

// ─── HTTP-утилита ──────────────────────────────────────────────────

function request(urlStr, options, body) {
  return new Promise((resolve, reject) => {
    const u    = new URL(urlStr);
    const lib  = u.protocol === 'https:' ? https : http;
    const port = u.port || (u.protocol === 'https:' ? 443 : 80);

    const reqOptions = {
      hostname          : u.hostname,
      port,
      path              : u.pathname + (u.search || ''),
      method            : options.method || 'POST',
      headers           : { ...(options.headers || {}) },
      rejectUnauthorized: false, // разрешить самоподписанный сертификат в dev
    };

    if (body) {
      reqOptions.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = lib.request(reqOptions, (res) => resolve(res));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function readBody(res) {
  return new Promise((resolve, reject) => {
    let data = '';
    res.on('data', chunk => (data += chunk));
    res.on('end',  () => resolve(data));
    res.on('error', reject);
  });
}

// ─── аутентификация ────────────────────────────────────────────────

async function fetchToken(creds) {
  log('Запрашиваем новый JWT-токен...');

  const body = JSON.stringify({ Login: creds.login, Password: creds.password });
  const res  = await request(
    `${creds.url}/api/public/v1/Auth/${creds.dbName}`,
    {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    body,
  );

  const data = await readBody(res);

  if (res.statusCode !== 200) {
    throw new Error(`Ошибка авторизации (${res.statusCode}): ${data}`);
  }

  const parsed    = JSON.parse(data);
  // ASP.NET Core сериализует ответ в camelCase: token / expiresAtUtc
  currentToken    = parsed.token ?? parsed.Token;
  const expiresAt = parsed.expiresAtUtc ?? parsed.ExpiresAtUtc;
  tokenExpiresAt  = new Date(expiresAt).getTime();
  log(`Токен получен, истекает: ${expiresAt}`);
  return currentToken;
}

async function ensureToken(creds) {
  if (currentToken && Date.now() < tokenExpiresAt - REFRESH_BEFORE_MS) {
    return currentToken;
  }
  return fetchToken(creds);
}

// ─── разбор SSE ────────────────────────────────────────────────────

function parseSseMessages(res) {
  return new Promise((resolve, reject) => {
    const messages = [];
    let   buffer   = '';

    res.on('data', chunk => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // оставляем неполную строку
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const payload = line.slice(6).trim();
          if (payload) messages.push(payload);
        }
      }
    });

    res.on('end', () => {
      if (buffer.startsWith('data: ')) {
        const payload = buffer.slice(6).trim();
        if (payload) messages.push(payload);
      }
      resolve(messages);
    });

    res.on('error', reject);
  });
}

// ─── проброс MCP-запроса ───────────────────────────────────────────

async function forwardToMcp(messageBody, creds) {
  const jwt = await ensureToken(creds);

  const res = await request(
    `${creds.url}/mcp`,
    {
      method : 'POST',
      headers: {
        'Content-Type' : 'application/json',
        'Accept'       : 'application/json, text/event-stream',
        'Authorization': `Bearer ${jwt}`,
      },
    },
    messageBody,
  );

  if (res.statusCode === 401) {
    currentToken = null; // принудительное обновление при следующем вызове
    throw new Error('401 Unauthorized');
  }

  const contentType = res.headers['content-type'] || '';

  if (contentType.includes('text/event-stream')) {
    return parseSseMessages(res);
  }

  const data = await readBody(res);
  return data.trim() ? [data.trim()] : [];
}

// ─── отправка JSON-RPC ошибки в stdout ─────────────────────────────

function writeError(rawMessage, errorMessage) {
  try {
    const req = JSON.parse(rawMessage);
    const out = JSON.stringify({
      jsonrpc: '2.0',
      id     : req.id ?? null,
      error  : { code: -32603, message: errorMessage },
    });
    process.stdout.write(out + '\n');
  } catch {
    // не удалось распарсить входящее сообщение — ничего не пишем
  }
}

// ─── main ──────────────────────────────────────────────────────────

async function main() {
  const creds = loadCredentials();

  // получаем токен заранее, чтобы не задерживать первый запрос
  await fetchToken(creds);

  const reader = rl.createInterface({ input: process.stdin, terminal: false });

  reader.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const messages = await forwardToMcp(trimmed, creds);
      for (const msg of messages) {
        process.stdout.write(msg + '\n');
      }
    } catch (err) {
      // при 401 — одна попытка с обновлённым токеном
      if (err.message.includes('401')) {
        try {
          await fetchToken(creds);
          const messages = await forwardToMcp(trimmed, creds);
          for (const msg of messages) {
            process.stdout.write(msg + '\n');
          }
        } catch (retryErr) {
          log(`Повторная попытка после 401 не удалась: ${retryErr.message}`);
          writeError(trimmed, retryErr.message);
        }
        return;
      }
      log(`Ошибка: ${err.message}`);
      writeError(trimmed, err.message);
    }
  });

  reader.on('close', () => process.exit(0));
}

main().catch(err => {
  log(`Fatal: ${err.message}`);
  process.exit(1);
});
