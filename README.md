# МойКод

> Консольный AI-ассистент для разработки — учебный проект с дизайном, вдохновлённым [Claude Code](https://claude.ai/code).

---

## Установка

### Linux / macOS

```bash
curl -fsSL https://raw.githubusercontent.com/netgomail/mycode/master/install.sh | bash
```

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/netgomail/mycode/master/install.ps1 | iex
```

Установщики автоматически скачивают последнюю версию из GitHub Releases и добавляют `mycode` в PATH.

---

## Обновление

```bash
mycode update
```

---

## Запуск из исходников

Требуется [Bun](https://bun.sh) ≥ 1.1.

```bash
bun install
bun start
```

---

## Сборка бинарников

```bash
bun run build:win    # → dist/mycode.exe        (Windows x64)
bun run build:linux  # → dist/mycode-linux      (Linux x64)
bun run build:mac    # → dist/mycode-mac-x64    (macOS x64)
#                      dist/mycode-mac-arm      (macOS ARM64)
bun run build:all    # все платформы
```

---

## Команды

| Команда | Описание |
|---|---|
| `/help` | Список всех команд |
| `/model` | Информация о текущей модели |
| `/status` | Статус сессии: аптайм, ОС, рабочая папка |
| `/files [путь]` | Листинг файлов в директории |
| `/run <команда>` | Выполнить команду (заглушка) |
| `/config` | Настройки приложения (заглушка) |
| `/version` | Версия приложения |
| `/clear` | Очистить историю |
| `/exit` / `/quit` | Завершить работу |

Любой текст без `/` — запрос к AI (спиннер + stub-ответ).

---

## Структура проекта

```
mycode/
├── src/
│   └── app.jsx          — исходник (React + Ink)
├── dist/                — скомпилированные бинарники (не в git)
├── bunbuild.mjs         — скрипт сборки
├── install.sh           — установщик Linux/macOS
├── install.ps1          — установщик Windows
└── package.json         — версия (единственный источник)
```

---

## Стек

| Технология | Роль |
|---|---|
| [React](https://react.dev) 19 | Компонентный UI |
| [Ink](https://github.com/vadimdemedes/ink) 6 | Рендеринг React в терминале |
| [Bun](https://bun.sh) | Runtime + компилятор в бинарник |

---

## Лицензия

MIT
