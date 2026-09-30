# Самописный JS -> BaSYS.FX

Справочник для шага 3 скилла [refactor-to-shared-modules](SKILL.md). Цель — найти код, который повторяет функцию BaSYS.FX, и заменить его вызовом библиотеки **без изменения поведения**.

Первоисточник: [алфавитный указатель BaSYS.FX](https://basysteam.github.io/BaSys.Docs/ru/calculations/methodsIndex.html). Разделы: [прочие функции](https://basysteam.github.io/BaSys.Docs/ru/calculations/otherFunctions.html), [даты](https://basysteam.github.io/BaSys.Docs/ru/calculations/dateFunctions.html), [DataTable](https://basysteam.github.io/BaSys.Docs/ru/calculations/dataTable.html), [соединения](https://basysteam.github.io/BaSys.Docs/ru/calculations/dataTableJoins.html), [распределение](https://basysteam.github.io/BaSys.Docs/ru/calculations/dataTableDistribution.html). Если функции нет в этом файле или сомневаешься в сигнатуре — сверить с документацией.

## Доступность по средам

| Среда | Что есть |
| :---- | :------- |
| Браузер (формулы, `itemsSource`, команды, формы) | вся библиотека, `from()` |
| Node (шаг процесса / источник данных с `await`) | вся библиотека, `from()` |
| ClearScript (шаг / источник данных без `await`, источник записей) | вся библиотека, **без** `from()` |
| Jint (формула колонки при записи движений) | **только** `isEmpty`, `isNotEmpty`, `iif`, `ifs`, `dateTimeNow`, `dateDifference` и расширения `Date` |

## Пустота и условия

| Паттерн в коде | Замена | Подводные камни |
| :------------- | :----- | :-------------- |
| `v === null \|\| v === undefined \|\| v === ''` | `isEmpty(v)` | `isEmpty` считает пустыми также `0`, `false` и объект без свойств. Если `0` — значимое значение (количество, сумма), **не заменять**. |
| `!v`, `v ? true : false`, `Boolean(v)` | `isEmpty(v)` / `isNotEmpty(v)` | Для объектов `!{}` — `false`, а `isEmpty({})` — `true`. |
| `Object.keys(o).length === 0` | `isEmpty(o)` | — |
| Вложенные тернарники `a ? x : b ? y : z`, `switch` с `return` значений | `ifs(a, x, b, y, true, z)` | Все аргументы `ifs` вычисляются **сразу**: не заменять, если ветки имеют побочные эффекты или дорогие вычисления. Без финального `true, default` результат — `null`. |
| `cond ? a : b` в однострочной формуле | `iif(cond, a, b)` | Необязательная замена ради читаемости. Обе ветки вычисляются сразу — не заменять, если ветка может упасть (`row.x.y` при пустом `row.x`). |

## Числа и строки

| Паттерн в коде | Замена | Подводные камни |
| :------------- | :----- | :-------------- |
| `const n = parseFloat(s); return isNaN(n) ? 0 : n;` | `parseNumber(s)` | `parseNumber` возвращает `0` для нераспознанной строки. Если код отличает «не число» от нуля (`NaN`, `null`) — не заменять. |
| `n.toFixed(2)` + ручная вставка пробелов по разрядам | `format(n, '#,##0.00')` | Разделитель разрядов — пробел, дробной части — точка. Для другого разделителя — `format(n, { decimals, decimalSeparator, groupSeparator })`. `toLocaleString('ru-RU')` даёт запятую и неразрывный пробел — это **другое** поведение. |
| `n.toFixed(3)` без группировки | `format(n, '0.000')` | `toFixed` возвращает строку так же; проверить, что группировка не включилась (нет `,` в формате). |
| Сборка `dd.MM.yyyy` из `getDate()` / `getMonth()+1` / `getFullYear()` с `padStart` | `format(date, 'dd.MM.yyyy')` | Токены: `yyyy yy MM M dd d HH H hh h mm m ss s SSS`. Формат по умолчанию — `dd.MM.yyyy`. |
| `v ? 'Да' : 'Нет'` для вывода | `format(v, { trueValue: 'Да', falseValue: 'Нет' })` | Необязательная замена. |
| Ручной `fetch` / `axios` к API запуска процесса с ожиданием результата | `await runWorkflow(name, resultStepName, parameters, timeout)` | Таймаут по умолчанию — 15 с. Функция асинхронная. |

## Даты

Расширения вызываются на объекте `Date`: `date.beginMonth()`. Все `begin*` / `end*` возвращают **новый** объект `Date`.

| Паттерн в коде | Замена | Подводные камни |
| :------------- | :----- | :-------------- |
| `new Date()` | `dateTimeNow()` | Эквивалентно; замена необязательна. |
| `d.setHours(0, 0, 0, 0)`, `new Date(d.getFullYear(), d.getMonth(), d.getDate())` | `d.beginDay()` | `setHours` **мутирует** `d`, `beginDay` — нет. Если код дальше рассчитывает на мутацию `d`, присвоить: `d = d.beginDay()`. |
| `setHours(23, 59, 59, 999)` | `d.endDay()` | То же про мутацию. |
| `new Date(y, m, 1)` | `d.beginMonth()` | — |
| `new Date(y, m + 1, 0)` / `new Date(y, m + 1, 0, 23, 59, 59, 999)` | `d.endMonth()` | `endMonth` — это 23:59:59.999, а `new Date(y, m + 1, 0)` — 00:00. Сравнения `<=` с датой со временем дадут разный результат. |
| Ручной расчёт начала / конца квартала через `Math.floor(m / 3) * 3` | `d.beginQuarter()` / `d.endQuarter()` | — |
| `new Date(y, 0, 1)` / `new Date(y, 11, 31, 23, 59, 59, 999)` | `d.beginYear()` / `d.endYear()` | — |
| `d.setDate(d.getDate() + n)` | `d.addDays(n)` | Дробная часть `n` отбрасывается. Проверить мутацию. |
| `d.setMonth(d.getMonth() + n)` | `d.addMonths(n)` | Дробная часть отбрасывается. Поведение на 31-е число сверить с документацией, если важно. |
| `setMonth(+3 * n)` / `setFullYear(+n)` | `d.addQuarters(n)` / `d.addYears(n)` | — |
| `Math.round((b - a) / 86400000)` | `dateDifference(a, b, 'day')` | Результат `b - a`, отрицательный, если `b < a`. Округление ручного кода (`round` / `floor` / `ceil`) может отличаться — сверить на граничных датах. |
| Разность месяцев через `(y2 - y1) * 12 + (m2 - m1)` | `dateDifference(a, b, 'month')` | Также `'quarter'` (3 месяца) и `'year'`. Сверить, учитывает ли ручной код день месяца. |
| Сборка `YYYY-MM-DDTHH:mm:ss` из компонентов, `toISOString()` со сдвигом часового пояса | `d.toLocalISO()` | `toISOString()` переводит в UTC, `toLocalISO()` — нет. Замена `toISOString` меняет поведение — делать только если сдвиг был ошибкой, и с согласия пользователя. |

## Табличные данные (DataTable)

Паттерны вида `table.rows.reduce(...)`, `table.rows.filter(...)`, ручные циклы по `rows` с накоплением.

| Паттерн в коде | Замена | Подводные камни |
| :------------- | :----- | :-------------- |
| Массив объектов, собираемый вручную для возврата таблицы | `createTable('a, b number').load(rows)` / `.addRow(...)` | В `addRow` массивом важен порядок колонок. |
| `rows.reduce((s, r) => s + r.x, 0)` | `table.sum('x')` | — |
| Среднее / минимум / максимум по колонке через `reduce` / `Math.min(...map)` | `table.avg('x')` / `.min('x')` / `.max('x')` | Сверить поведение на пустой таблице. |
| `rows.length` | `table.count()` | — |
| `rows.filter(r => r.x).length` | `table.count('x')` | `count('x')` считает пустыми `null`, `undefined`, `''`, `0`, `false`. |
| `rows.filter(pred)` с пересборкой таблицы | `table.filter(pred)` | Возвращает `DataTable`, а не массив. |
| `rows.sort(cmp)` | `table.orderBy(cmp)` | Сортирует **текущую** таблицу на месте и возвращает её. |
| `rows.forEach(r => r.c = …)` | `table.process(r => r.c = …)` | Возвращает таблицу — удобно в цепочке. |
| `rows.map(r => r.x)` | `table.toArray('x', false)` | По умолчанию `distinctOnly = true` — без `false` дубликаты пропадут. |
| `[...new Set(rows.map(r => r.x))]` | `table.toArray('x')` | — |
| Группировка через объект-аккумулятор `acc[key] = (acc[key] \|\| 0) + r.q` | `table.groupBy(['key'], ['q'])` или `{ name, alias, aggregate: 'sum' \| 'avg' \| 'count' \| 'min' \| 'max' }` | Колонки, не указанные в ключах и агрегатах, в результат не попадают. |
| Нарастающий итог в цикле | `table.addColumn('x_cum number').cumSum('x_cum', 'x')` | — |
| `concat` строк двух таблиц | `a.unionAll(b)`; без дублей — `a.union(b)` | `union` сравнивает строки целиком и медленнее. |
| Вложенные циклы «найти строку по ключу во второй таблице» | `innerJoin` / `leftJoin` / `rightJoin` / `fullJoin` | Сигнатуру и именование колонок результата сверить с [документацией соединений](https://basysteam.github.io/BaSys.Docs/ru/calculations/dataTableJoins.html). |
| Разворот колонок `d_01…d_31` в строки | `table.unpivot('value', ['d_01', …], 'day_number', 'day_name')` | — |
| Ручное распределение суммы по строкам в порядке FIFO / LIFO | `distributeFifo` / `distributeLifo` | Сверить с [документацией распределения](https://basysteam.github.io/BaSys.Docs/ru/calculations/dataTableDistribution.html). |
| Глубокое копирование таблицы через `JSON.parse(JSON.stringify(...))` | `table.clone()` | `JSON`-копия превращает `Date` в строки — `clone` этого не делает, поведение может измениться в лучшую сторону; отметить в отчёте. |

## Запросы

| Паттерн в коде | Замена | Подводные камни |
| :------------- | :----- | :-------------- |
| Ручные HTTP-вызовы к API данных, сырые SQL-строки | `await from('kind.name').select([...]).where('...').parameter(...).query()` | `from()` есть только в Node и браузере: в ClearScript-шаге его появление потребует `await`, что переводит шаг в Node — отметить в «Рисках». |

## Когда не заменять

- Поведение отличается хотя бы на одном реальном значении (`0` как значимое число, `NaN` против `0`, мутация даты, UTC против локального времени, дубликаты в `toArray`).
- Функции нет в среде вызова (Jint, ClearScript без `from()`).
- В программируемой форме код работает с обычным массивом для PrimeVue `DataTable` / дерева, а не с `DataTable` из BaSYS.FX: оборачивать массив в `createTable` ради одной агрегации не нужно.
- Замена ухудшает читаемость (длинная цепочка вместо одного понятного цикла с побочными эффектами).
