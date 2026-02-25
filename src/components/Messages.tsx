import React from 'react';
import { Box, Text } from 'ink';
import { Spinner } from './Spinner';

export function UserMessage({ content }: { content: string }) {
  return (
    <Box marginBottom={1} paddingLeft={2}>
      <Text color="white" bold>{'> '}</Text>
      <Text color="white">{content}</Text>
    </Box>
  );
}

export function AssistantMessage({ content }: { content: string }) {
  return (
    <Box marginBottom={1} paddingLeft={2}>
      <Text color="magenta" bold>{'◆  '}</Text>
      <Text>{content}</Text>
    </Box>
  );
}

export function SystemMessage({ content }: { content: string }) {
  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={4}>
      {content.split('\n').map((line, i) => (
        <Text key={i} color="gray">{line}</Text>
      ))}
    </Box>
  );
}

export function ErrorMessage({ content }: { content: string }) {
  return (
    <Box marginBottom={1} paddingLeft={2}>
      <Text color="red">{'✗  '}</Text>
      <Text color="red">{content}</Text>
    </Box>
  );
}

export function Thinking() {
  return (
    <Box marginBottom={1} paddingLeft={2}>
      <Spinner />
      <Text color="gray">{'  Думаю...'}</Text>
    </Box>
  );
}
