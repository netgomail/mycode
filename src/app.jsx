import React, { useState, useReducer, useEffect, useCallback, useTransition } from 'react';
import { render, Box, Text, useInput, useApp, useStdout } from 'ink';
import { readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';

const VERSION = '0.2.0';
const REPO    = 'netgomail/mycode';
let _msgId = 0;

// ─── Self-update ──────────────────────────────────────────────────────────────
function getPlatformBinary() {
  if (process.platform === 'win32') return 'mycode.exe';
  if (process.platform === 'darwin')
    return process.arch === 'arm64' ? 'mycode-mac-arm' : 'mycode-mac-x64';
  return 'mycode-linux';
}

async function selfUpdate(onProgress = () => {}) {
  onProgress('Проверяю обновления...');
  let release;
  try {
    const resp = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
    if (!resp.ok) throw new Error('GitHub API: HTTP ' + resp.status);
    release = await resp.json();
  } catch (e) {
    return 'Ошибка при проверке обновлений: ' + e.message;
  }

  const latest = release.tag_name.replace(/^v/, '');
  if (latest === VERSION) {
    return `Уже установлена последняя версия v${VERSION}`;
  }

  onProgress(`Скачиваю v${latest}...`);
  const binaryName = getPlatformBinary();
  const url = `https://github.com/${REPO}/releases/download/v${latest}/${binaryName}`;

  let data;
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    data = new Uint8Array(await resp.arrayBuffer());
  } catch (e) {
    return 'Ошибка при скачивании: ' + e.message;
  }

  // Detect compiled binary vs dev mode (bun src/app.jsx)
  const exePath = process.execPath;
  const exeName = basename(exePath).toLowerCase();
  if (exeName.startsWith('bun')) {
    return 'Обновление доступно: v' + VERSION + ' → v' + latest + '\nЗапустите установщик чтобы обновить: install.sh / install.ps1';
  }

  try {
    if (process.platform === 'win32') {
      // Cannot overwrite a running .exe — download as .new, schedule swap
      const newPath = exePath + '.new';
      await Bun.write(newPath, data);
      const { spawn } = await import('child_process');
      const ps = `Start-Sleep -Seconds 1; Move-Item -Force '${newPath}' '${exePath}'`;
      spawn('powershell.exe', ['-WindowStyle', 'Hidden', '-Command', ps], {
        detached: true, stdio: 'ignore',
      }).unref();
      return [
        `Обновление скачано: v${VERSION} → v${latest}`,
        'Замена выполнится после выхода. Перезапустите mycode.',
      ].join('\n');
    } else {
      const { writeFileSync, chmodSync } = await import('fs');
      writeFileSync(exePath, data);
      chmodSync(exePath, 0o755);
      return `Обновлено до v${latest}. Перезапустите mycode.`;
    }
  } catch (e) {
    return 'Ошибка при установке: ' + e.message;
  }
}

// ─── Messages reducer ─────────────────────────────────────────────────────────
function messagesReducer(state, action) {
  switch (action.type) {
    case 'add':   return [...state, { id: ++_msgId, role: action.role, content: action.content }];
    case 'clear': return [];
    default:      return state;
  }
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
const FRAMES = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];

function Spinner() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI(n => (n + 1) % FRAMES.length), 80);
    return () => clearInterval(t);
  }, []);
  return <Text color="cyan">{FRAMES[i]}</Text>;
}

// ─── Header ───────────────────────────────────────────────────────────────────
function Header() {
  const { stdout } = useStdout();
  const width = stdout?.columns ?? 80;
  const cwd = process.cwd();
  const home = homedir();
  const dir = (cwd.startsWith(home) ? '~' + cwd.slice(home.length) : cwd).replace(/\\/g, '/');

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box borderStyle="round" borderColor="cyan" paddingX={1} width={width}>
        <Text color="cyan" bold>{'◆  '}</Text>
        <Text bold>МойКод  </Text>
        <Text color="gray" dimColor>{'v' + VERSION + '  ·  '}</Text>
        <Text color="green">{dir}</Text>
      </Box>
    </Box>
  );
}

// ─── Welcome tips ─────────────────────────────────────────────────────────────
const TIPS = [
  ['/help',   'список всех команд'],
  ['/files',  'файлы в текущей папке'],
  ['/model',  'информация о модели'],
  ['/status', 'статус сессии'],
  ['/exit',   'выход'],
];

function WelcomeTips() {
  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={2}>
      <Box marginBottom={1}>
        <Text color="gray">Начните вводить сообщение или используйте команду:</Text>
      </Box>
      {TIPS.map(([cmd, desc]) => (
        <Box key={cmd}>
          <Text color="gray">{'  • '}</Text>
          <Text color="cyan">{cmd}</Text>
          <Text color="gray">{'  ' + desc}</Text>
        </Box>
      ))}
    </Box>
  );
}

// ─── Message components ───────────────────────────────────────────────────────
function UserMessage({ content }) {
  return (
    <Box marginBottom={1} paddingLeft={2}>
      <Text color="white" bold>{'> '}</Text>
      <Text color="white">{content}</Text>
    </Box>
  );
}

function AssistantMessage({ content }) {
  return (
    <Box marginBottom={1} paddingLeft={2}>
      <Text color="magenta" bold>{'◆  '}</Text>
      <Text>{content}</Text>
    </Box>
  );
}

function SystemMessage({ content }) {
  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={4}>
      {content.split('\n').map((line, i) => (
        <Text key={i} color="gray">{line}</Text>
      ))}
    </Box>
  );
}

function ErrorMessage({ content }) {
  return (
    <Box marginBottom={1} paddingLeft={2}>
      <Text color="red">{'✗  '}</Text>
      <Text color="red">{content}</Text>
    </Box>
  );
}

function Thinking() {
  return (
    <Box marginBottom={1} paddingLeft={2}>
      <Spinner />
      <Text color="gray">{'  Думаю...'}</Text>
    </Box>
  );
}

// ─── Input box ────────────────────────────────────────────────────────────────
function InputBox({ value, isThinking }) {
  const { stdout } = useStdout();
  const width = stdout?.columns ?? 80;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box
        borderStyle="round"
        borderColor={isThinking ? 'gray' : 'cyan'}
        paddingX={1}
        width={width}
        minHeight={3}
      >
        <Box flexGrow={1}>
          {isThinking ? (
            <Box>
              <Spinner />
              <Text color="gray">{'  Ожидание ответа...'}</Text>
            </Box>
          ) : (
            <Box>
              <Text color="cyan" bold>{'> '}</Text>
              <Text color="white">{value}</Text>
              <Text backgroundColor="cyan" color="black">{' '}</Text>
            </Box>
          )}
        </Box>
      </Box>
      <Box paddingLeft={2}>
        <Text color="gray" dimColor>
          {'Enter отправить  ·  Ctrl+C выход  ·  /help команды'}
        </Text>
      </Box>
    </Box>
  );
}

// ─── Commands hook ────────────────────────────────────────────────────────────
function useCommands(dispatch, exit) {
  return useCallback((cmd, arg) => {
    const add = (role, content) => dispatch({ type: 'add', role, content });

    switch (cmd) {
      case '/exit':
      case '/quit':
        exit();
        break;

      case '/clear':
        dispatch({ type: 'clear' });
        break;

      case '/help':
        add('system', [
          'Доступные команды:',
          '',
          '  /help            показать этот список',
          '  /clear           очистить историю',
          '  /version         версия приложения',
          '  /model           информация о модели',
          '  /status          статус сессии',
          '  /files [путь]    файлы в директории',

          '  /run <команда>   выполнить команду (заглушка)',
          '  /config          настройки (заглушка)',
          '  /exit            завершить работу',
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
          const dirs = [], files = [];
          for (const name of entries) {
            try {
              const st = statSync(join(target, name));
              st.isDirectory() ? dirs.push(name) : files.push({ name, size: st.size });
            } catch { files.push({ name, size: 0 }); }
          }
          const fmt = sz =>
            sz > 1048576 ? (sz / 1048576).toFixed(1) + ' МБ' :
            sz > 1024    ? (sz / 1024).toFixed(1)    + ' КБ' :
                           sz + ' Б';
          add('system', [
            target.replace(/\\/g, '/'), '',
            ...dirs.sort().map(d => '  📁  ' + d + '/'),
            ...files.sort((a, b) => a.name.localeCompare(b.name)).map(f => '  📄  ' + f.name + '  ' + fmt(f.size)),
            '', '  ' + dirs.length + ' папок, ' + files.length + ' файлов',
          ].join('\n'));
        } catch {
          add('error', 'Не удалось открыть: ' + target);
        }
        break;
      }

      case '/run':
        add('system', '[заглушка] В реальной версии выполнилась бы: ' + (arg || '(пусто)'));
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

      default:
        add('error', 'Неизвестная команда: ' + cmd + '  (введите /help)');
    }
  }, [dispatch, exit]);
}

// ─── Stub AI responses ────────────────────────────────────────────────────────
const STUB_RESPONSES = [
  t => 'Понял задачу: "' + t.slice(0, 60) + (t.length > 60 ? '…' : '') + '". Обрабатываю...',
  () => 'Хороший вопрос! В реальной версии здесь был бы настоящий ответ.',
  () => 'Анализирую запрос. Это заглушка — AI не подключён.',
  () => 'Запрос принят. Токенов: ~' + (Math.floor(Math.random() * 200) + 50) + ' [заглушка]',
];

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  const { exit } = useApp();
  const [input, setInput] = useState('');
  const [messages, dispatch] = useReducer(messagesReducer, []);
  const [isPending, startTransition] = useTransition();

  const handleCommand = useCommands(dispatch, exit);

  const handleSubmit = useCallback((text) => {
    const t = text.trim();
    if (!t || isPending) return;

    if (t.startsWith('/')) {
      const sp = t.indexOf(' ');
      const cmd = sp === -1 ? t : t.slice(0, sp);
      const arg = sp === -1 ? '' : t.slice(sp + 1).trim();

      handleCommand(cmd.toLowerCase(), arg);
      return;
    }

    dispatch({ type: 'add', role: 'user', content: t });

    // React 19: startTransition accepts async functions;
    // isPending stays true until the async function resolves
    startTransition(async () => {
      await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
      const fn = STUB_RESPONSES[Math.floor(Math.random() * STUB_RESPONSES.length)];
      dispatch({ type: 'add', role: 'assistant', content: fn(t) });
    });
  }, [isPending, dispatch, handleCommand]);

  useInput((char, key) => {
    if (key.ctrl && char === 'c') { exit(); return; }
    if (key.return) { handleSubmit(input); setInput(''); return; }
    if (key.backspace || key.delete) { setInput(s => s.slice(0, -1)); return; }
    if (!key.ctrl && !key.meta && !key.escape && char) {
      setInput(s => s + char);
    }
  });

  return (
    <Box flexDirection="column">
      <Header />
      {messages.length === 0 && <WelcomeTips />}
      {messages.map(msg => {
        if (msg.role === 'user')      return <UserMessage      key={msg.id} content={msg.content} />;
        if (msg.role === 'assistant') return <AssistantMessage key={msg.id} content={msg.content} />;
        if (msg.role === 'error')     return <ErrorMessage     key={msg.id} content={msg.content} />;
        return                               <SystemMessage    key={msg.id} content={msg.content} />;
      })}
      {isPending && <Thinking />}
      <InputBox value={input} isThinking={isPending} />
    </Box>
  );
}

// ─── CLI update mode: `mycode update` ────────────────────────────────────────
if (process.argv[2] === 'update') {
  const step = msg => process.stdout.write('  > ' + msg + '\n');
  process.stdout.write('\n  МойКод — обновление\n\n');
  const result = await selfUpdate(step);
  result.split('\n').forEach(l => process.stdout.write('  ' + l + '\n'));
  process.stdout.write('\n');
  process.exit(0);
} else {
  render(<App />);
}
