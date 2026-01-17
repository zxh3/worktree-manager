/**
 * Status bar with keyboard shortcuts
 */

import { Box, Text } from "ink";
import { theme } from "../theme";

export function StatusBar() {
  return (
    <Box paddingLeft={3} marginBottom={1}>
      <Text>
        <Text dimColor>[</Text>
        <Text color={theme.accent}>↵</Text>
        <Text dimColor>]</Text>
        <Text dimColor> select </Text>
        <Text dimColor>[</Text>
        <Text color={theme.accent}>q</Text>
        <Text dimColor>]</Text>
        <Text dimColor> quit </Text>
        <Text dimColor>[</Text>
        <Text color={theme.accent}>n</Text>
        <Text dimColor>]</Text>
        <Text dimColor> new </Text>
        <Text dimColor>[</Text>
        <Text color={theme.accent}>d</Text>
        <Text dimColor>]</Text>
        <Text dimColor> delete </Text>
        <Text dimColor>[</Text>
        <Text color={theme.accent}>r</Text>
        <Text dimColor>]</Text>
        <Text dimColor> rename </Text>
        <Text dimColor>[</Text>
        <Text color={theme.accent}>i</Text>
        <Text dimColor>]</Text>
        <Text dimColor> info</Text>
      </Text>
    </Box>
  );
}
