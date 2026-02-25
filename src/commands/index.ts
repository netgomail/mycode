import { useCallback } from 'react';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { version as VERSION } from '../../package.json';
import { collectInventory, formatInventory } from '../features/inventory';
import { generatePassword, checkStrength, parsePassArgs } from '../features/passgen';
import type { Screen } from '../types';

export const COMMANDS = [
  '/clear', '/config', '/exit', '/files',
  '/hardening', '/help', '/inventory',
  '/model', '/pass', '/quit', '/run',
  '/status', '/version',
];

type AddFn = (role: 'user' | 'assistant' | 'system' | 'error', content: string) => void;

export function useCommands(
  add: AddFn,
  clear: () => void,
  exit: () => void,
  openScreen: (s: Screen) => void,
) {
  return useCallback((cmd: string, arg: string) => {

    switch (cmd) {
      case '/exit':
      case '/quit':
        exit();
        break;

      case '/clear':
        clear();
        break;

      case '/help':
        add('system', [
          'Доступные команды:',
          '',
          '  /help                    показать этот список',
          '  /clear                   очистить историю',
          '  /version                 версия приложения',
          '  /model                   информация о модели',
          '  /status                  статус сессии',
          '  /files [путь]            файлы в директории',
          '  /run <команда>           выполнить команду (заглушка)',
          '  /config                  настройки (заглушка)',
          '',
          '  /hardening               чеклист харденинга Linux (авто-проверка)',
          '  /inventory [файл.txt]    инвентаризация системы',
          '  /pass [--length N] [--symbols] [--count N] [--no-ambiguous]',
          '  /pass check "пароль"     оценить стойкость пароля',
          '',
          '  /exit                    завершить работу',
        ].join('\n'));
        break;

      case '/version':
        add('system', 'МойКод v' + VERSION);
        break;

      case '/model':
        add('system', [
          'Модель:     mycode-stub-1',
          'Провайдер:  localhost (заглушка)',
          'Контекст:   200 000 токенов',
          'Статус:     ● онлайн',
        ].join('\n'));
        break;

      case '/status': {
        const up = process.uptime();
        const m = Math.floor(up / 60), s = Math.floor(up % 60);
        add('system', [
          'Статус:         ● активна',
          'Аптайм:         ' + (m > 0 ? m + 'м ' : '') + s + 'с',
          'Рабочая папка:  ' + process.cwd().replace(/\\/g, '/'),
          'Bun:            ' + process.version,
          'ОС:             ' + (process.platform === 'win32' ? 'Windows' : process.platform),
        ].join('\n'));
        break;
      }

      case '/files': {
        const target = arg || process.cwd();
        try {
          const entries = readdirSync(target);
          const dirs: string[] = [], files: { name: string; size: number }[] = [];
          for (const name of entries) {
            try {
              const st = statSync(join(target, name));
              st.isDirectory() ? dirs.push(name) : files.push({ name, size: st.size });
            } catch { files.push({ name, size: 0 }); }
          }
          const fmt = (sz: number) =>
            sz > 1048576 ? (sz / 1048576).toFixed(1) + ' МБ' :
            sz > 1024    ? (sz / 1024).toFixed(1)    + ' КБ' :
                           sz + ' Б';
          add('system', [
            target.replace(/\\/g, '/'), '',
            ...dirs.sort().map(d => '  📁  ' + d + '/'),
            ...files.sort((a, b) => a.name.localeCompare(b.name))
                    .map(f => '  📄  ' + f.name + '  ' + fmt(f.size)),
            '', '  ' + dirs.length + ' папок, ' + files.length + ' файлов',
          ].join('\n'));
        } catch {
          add('error', 'Не удалось открыть: ' + target);
        }
        break;
      }

      case '/run':
        add('system', '[заглушка] Выполнилась бы: ' + (arg || '(пусто)'));
        break;

      case '/config':
        add('system', [
          'Настройки (заглушка):',
          '  Тема:            dark',
          '  Язык:            ru',
          '  Автосохранение:  включено',
          '  Телеметрия:      выключена',
        ].join('\n'));
        break;

      // ── Feature 1: Чеклист харденинга ─────────────────────────────────────
      case '/hardening':
        if (process.platform !== 'linux') {
          add('error', 'Чеклист харденинга доступен только на Linux.');
        } else {
          openScreen('hardening');
        }
        break;

      // ── Feature 4: Инвентаризация ──────────────────────────────────────────
      case '/inventory':
        add('system', 'Собираю данные о системе...');
        collectInventory().then(sections => {
          const text = formatInventory(sections);
          if (arg) {
            const filename = arg.trim();
            Bun.write(filename, text).then(() => {
              add('system', `✓ Инвентаризация сохранена: ${filename}`);
            }).catch(() => {
              add('error', 'Не удалось записать файл: ' + filename);
            });
          } else {
            add('system', text);
          }
        }).catch(e => {
          add('error', 'Ошибка инвентаризации: ' + (e as Error).message);
        });
        break;

      // ── Feature 5: Генератор паролей ───────────────────────────────────────
      case '/pass': {
        const { opts, checkMode } = parsePassArgs(arg);

        if (checkMode !== null) {
          if (!checkMode) { add('error', 'Укажите пароль: /pass check "пароль"'); break; }
          const result = checkStrength(checkMode);
          const bar = '█'.repeat(result.score) + '░'.repeat(5 - result.score);
          add('system', [
            `Пароль:   ${checkMode}`,
            `Стойкость: [${bar}]  ${result.score}/5 — ${result.label}`,
            '',
            'Факторы:',
            ...result.details.map(d => '  • ' + d),
          ].join('\n'));
          break;
        }

        const passwords: string[] = [];
        for (let i = 0; i < opts.count; i++) {
          passwords.push(generatePassword(opts));
        }

        const info = [
          `длина=${opts.length}`,
          opts.symbols ? '+спецсимволы' : '',
          opts.noAmbiguous ? '-неоднозначные' : '',
        ].filter(Boolean).join('  ');

        if (passwords.length === 1) {
          const pw = passwords[0];
          const strength = checkStrength(pw);
          const bar = '█'.repeat(strength.score) + '░'.repeat(5 - strength.score);
          add('system', [
            `Пароль:    ${pw}`,
            `Стойкость: [${bar}]  ${strength.score}/5 — ${strength.label}`,
            `Параметры: ${info}`,
          ].join('\n'));
        } else {
          add('system', [
            `Сгенерировано ${passwords.length} паролей  (${info}):`,
            '',
            ...passwords.map((p, i) => `  ${String(i + 1).padStart(2)}.  ${p}`),
          ].join('\n'));
        }
        break;
      }

      default:
        add('error', 'Неизвестная команда: ' + cmd + '  (введите /help)');
    }
  }, [add, clear, exit, openScreen]);
}
