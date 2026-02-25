import React from 'react';
import { Box, Text, useStdout } from 'ink';
import { homedir } from 'os';
import { version as VERSION } from '../../package.json';

export function Header() {
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
