import { KbdShortcut } from "@/components/asciicn/kbd-shortcut";

const ACTIONS = [
  { keys: "mod+k", label: "Search docs" },
  { keys: "mod+shift+c", label: "Copy as ANSI" },
  { keys: "mod+e", label: "Export PNG" },
  { keys: "g s", label: "Go to Studio" },
  { keys: "?", label: "All shortcuts" },
] as const;

export default function KbdShortcutMenu() {
  return (
    <ul className="bg-background border-border flex w-full max-w-sm flex-col rounded-lg border p-1.5 text-sm">
      {ACTIONS.map((action) => (
        <li
          key={action.label}
          className="hover:bg-muted flex items-center justify-between gap-4 rounded-md px-3 py-2"
        >
          <span className="truncate">{action.label}</span>
          <KbdShortcut keys={action.keys} variant="inline" />
        </li>
      ))}
    </ul>
  );
}
