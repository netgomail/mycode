import React from 'react';
import { Box, Text } from 'ink';

const TIPS: [string, string][] = [
  ['/help',       'список всех команд'],
  ['/files',      'файлы в текущей папке'],
  ['/status',     'статус сессии'],
  ['/hardening',  'чеклист харденинга Linux'],
  ['/inventory',  'инвентаризация системы'],
  ['/pass',       'генератор паролей'],
  ['/exit',       'выход'],
];

export function WelcomeTips() {
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
