import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { buildChecks, statusIcon, statusColor } from '../features/hardening';
import type { CheckItem, CheckStatus } from '../features/hardening';

interface Props {
  onExit: () => void;
}

export function HardeningScreen({ onExit }: Props) {
  const { stdout } = useStdout();
  const width = stdout?.columns ?? 80;

  const [checks] = useState<CheckItem[]>(() => buildChecks());
  const [results, setResults] = useState<Map<string, CheckStatus>>(new Map());
  const [selected, setSelected] = useState(0);
  const [exported, setExported] = useState<string | null>(null);
  const [running, setRunning] = useState(true);

  // Запускаем все проверки при монтировании
  useEffect(() => {
    const map = new Map<string, CheckStatus>();
    for (const item of checks) {
      try { map.set(item.id, item.check()); }
      catch { map.set(item.id, 'unknown'); }
    }
    setResults(map);
    setRunning(false);
  }, [checks]);

  useInput((char, key) => {
    if (key.upArrow)   setSelected(i => Math.max(0, i - 1));
    if (key.downArrow) setSelected(i => Math.min(checks.length - 1, i + 1));

    if (char === 'q' || key.escape) { onExit(); return; }

    if (char === 'e') {
      const date = new Date().toISOString().slice(0, 10);
      const filename = `hardening-report-${date}.txt`;
      const lines: string[] = [
        '=== Отчёт харденинга Linux ===',
        `Дата: ${new Date().toLocaleString('ru-RU')}`,
        `Хост: ${process.env.HOSTNAME ?? 'неизвестно'}`,
        '',
      ];

      const categories = [...new Set(checks.map(c => c.category))];
      for (const cat of categories) {
        lines.push(`── ${cat} ──`);
        for (const item of checks.filter(c => c.category === cat)) {
          const s = results.get(item.id) ?? 'unknown';
          lines.push(`  [${statusIcon(s)}] ${item.title}`);
          if (s !== 'pass') lines.push(`       Рекомендация: ${item.hint}`);
        }
        lines.push('');
      }

      const pass = [...results.values()].filter(s => s === 'pass').length;
      const fail = [...results.values()].filter(s => s === 'fail').length;
      const warn = [...results.values()].filter(s => s === 'warn').length;
      lines.push(`Итого: ✓ ${pass} пройдено  ✗ ${fail} не пройдено  ⚠ ${warn} предупреждений`);

      try {
        Bun.write(filename, lines.join('\n') + '\n');
        setExported(filename);
      } catch { setExported('Ошибка записи файла'); }
    }
  });

  // Считаем статистику
  const pass = [...results.values()].filter(s => s === 'pass').length;
  const fail = [...results.values()].filter(s => s === 'fail').length;

  // Группировка по категориям
  const categories = [...new Set(checks.map(c => c.category))];

  const selectedItem = checks[selected];
  const selectedStatus = selectedItem ? (results.get(selectedItem.id) ?? 'unknown') : 'unknown';

  return (
    <Box flexDirection="column" width={width}>
      {/* Заголовок */}
      <Box borderStyle="round" borderColor="cyan" paddingX={1} marginBottom={1} width={width}>
        <Text color="cyan" bold>◆  </Text>
        <Text bold>Чеклист харденинга Linux  </Text>
        {running
          ? <Text color="gray">Проверяю...</Text>
          : <Text color="gray">
              <Text color="green">{`✓ ${pass}`}</Text>
              <Text color="gray">  </Text>
              <Text color="red">{`✗ ${fail}`}</Text>
              <Text color="gray">{`  из ${checks.length}`}</Text>
            </Text>
        }
      </Box>

      {/* Список проверок */}
      {categories.map(cat => (
        <Box key={cat} flexDirection="column" marginBottom={1}>
          <Box paddingLeft={2}>
            <Text color="cyan" bold>{`── ${cat} ──`}</Text>
          </Box>
          {checks.filter(c => c.category === cat).map((item, _i) => {
            const globalIdx = checks.indexOf(item);
            const isSelected = globalIdx === selected;
            const status = results.get(item.id) ?? 'unknown';
            const icon = running ? '…' : statusIcon(status);
            const color = running ? 'gray' : statusColor(status);
            return (
              <Box key={item.id} paddingLeft={3}>
                <Text color={isSelected ? 'white' : 'gray'}>{isSelected ? '❯ ' : '  '}</Text>
                <Text color={color as Parameters<typeof Text>[0]['color']} bold={isSelected}>
                  {`[${icon}] `}
                </Text>
                <Text color={isSelected ? 'white' : 'gray'} bold={isSelected}>
                  {item.title}
                </Text>
              </Box>
            );
          })}
        </Box>
      ))}

      {/* Подсказка для выбранного пункта */}
      {!running && selectedStatus !== 'pass' && (
        <Box paddingLeft={4} marginBottom={1}>
          <Text color="yellow">{'↳ '}</Text>
          <Text color="yellow">{selectedItem?.hint}</Text>
        </Box>
      )}

      {/* Сообщение об экспорте */}
      {exported && (
        <Box paddingLeft={2} marginBottom={1}>
          <Text color="green">{`✓ Отчёт сохранён: ${exported}`}</Text>
        </Box>
      )}

      {/* Подвал */}
      <Box paddingLeft={2}>
        <Text color="gray" dimColor>
          {'↑↓ навигация  ·  E экспорт отчёта  ·  Q/Esc выход'}
        </Text>
      </Box>
    </Box>
  );
}
