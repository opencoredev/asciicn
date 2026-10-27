import { AsciiTabs } from "@/components/asciicn/ascii-tabs";
import type { AsciiTab } from "@/components/asciicn/ascii-tabs";

const URL = "https://asciicn.dev/r/ascii-tabs.json";

const MANAGERS = [
  ["pnpm", `pnpm dlx shadcn@latest add ${URL}`],
  ["npm", `npx shadcn@latest add ${URL}`],
  ["yarn", `yarn dlx shadcn@latest add ${URL}`],
  ["bun", `bunx --bun shadcn@latest add ${URL}`],
] as const;

const TABS: readonly AsciiTab[] = MANAGERS.map(([name, command]) => ({
  content: (
    <code className="text-muted-foreground block font-mono text-xs break-all">
      <span className="text-foreground">$ </span>
      {command}
    </code>
  ),
  label: name,
  value: name,
}));

export default function AsciiTabsInstall() {
  return (
    <AsciiTabs
      tabs={TABS}
      label="Package manager"
      variant="underline"
      color="green"
      className="max-w-md"
    />
  );
}
