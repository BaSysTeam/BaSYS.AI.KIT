# BaSYS.AI.KIT

## Русский

BaSYS.AI.KIT - готовый набор настроек, правил и skills для работы с BaSYS AI-инструментами.

Репозиторий содержит подготовленные конфигурации для:

- Cursor: `dist/.cursor`
- OpenCode: `dist/.opencode`

### Использование

Чтобы подключить подготовленные настройки, просто скопируйте нужные папки из `dist` в папку вашего проекта.

Например, для Cursor:

```powershell
Copy-Item -Recurse -Force .\dist\.cursor C:\Path\To\Your\Project\
```

Для OpenCode:

```powershell
Copy-Item -Recurse -Force .\dist\.opencode C:\Path\To\Your\Project\
```

После копирования откройте проект в выбранном AI-инструменте. Настройки, правила и skills будут находиться внутри папки проекта.

Для подключения к BaSYS MCP-серверу создайте файл с учетными данными на основе примера:

- `dist/.cursor/basys-credentials.example.json`
- `dist/.opencode/basys-credentials.example.json`

Не добавляйте реальные учетные данные в систему контроля версий.

Подробнее о подключении MCP-сервера:

- [Cursor](https://basysteam.github.io/BaSys.Docs/ru/integration/mcpCursor.html)
- [OpenCode](https://basysteam.github.io/BaSys.Docs/ru/integration/mcpOpenCode.html)

## English

BaSYS.AI.KIT is a ready-to-use toolkit of configurations, rules, and skills for BaSYS AI tools.

The repository contains prepared configurations for:

- Cursor: `dist/.cursor`
- OpenCode: `dist/.opencode`

### Usage

To use the prepared settings, simply copy the required folders from `dist` into your project folder.

For Cursor:

```powershell
Copy-Item -Recurse -Force .\dist\.cursor C:\Path\To\Your\Project\
```

For OpenCode:

```powershell
Copy-Item -Recurse -Force .\dist\.opencode C:\Path\To\Your\Project\
```

After copying, open the project in the selected AI tool. The settings, rules, and skills will be available inside the project folder.

To connect to the BaSYS MCP server, create a credentials file based on the provided example:

- `dist/.cursor/basys-credentials.example.json`
- `dist/.opencode/basys-credentials.example.json`

Do not commit real credentials to version control.

More details about connecting the MCP server:

- [Cursor](https://basysteam.github.io/BaSys.Docs/ru/integration/mcpCursor.html)
- [OpenCode](https://basysteam.github.io/BaSys.Docs/ru/integration/mcpOpenCode.html)
