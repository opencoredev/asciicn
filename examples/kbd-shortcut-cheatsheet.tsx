import { KbdShortcut } from "@/components/asciicn/kbd-shortcut";

const GROUPS = [
  {
    items: [
      { keys: "space", label: "Play or pause" },
      { keys: "left", label: "Step back a frame" },
      { keys: "right", label: "Step forward a frame" },
    ],
    title: "Playback",
  },
  {
    items: [
      { keys: "mod+z", label: "Undo" },
      { keys: "mod+shift+z", label: "Redo" },
      { keys: "mod+s", label: "Save preset" },
    ],
    title: "Editing",
  },
] as const;

export default function KbdShortcutCheatsheet() {
  return (
    <div className="grid w-full max-w-2xl gap-8 sm:grid-cols-2">
      {GROUPS.map((group) => (
        <section key={group.title} className="flex flex-col gap-3">
          <h3 className="text-muted-foreground font-mono text-xs">
            {group.title}
          </h3>
          <ul className="flex flex-col gap-3">
            {group.items.map((item) => (
              <li
                key={item.label}
                className="flex items-center justify-between gap-4 text-sm"
              >
                <span>{item.label}</span>
                <KbdShortcut keys={item.keys} color="grey" />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
