"use client";

import { charsetShortcut } from "@/components/studio/controls";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { CHARSET_NAMES, CHARSETS } from "@/lib/ascii/charsets";

const SHORTCUTS = [
  { keys: ["Space"], label: "Pause or resume" },
  { keys: ["E"], label: "Open the export menu" },
  { keys: ["?"], label: "Show this help" },
] as const;

export const HelpDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="rounded-[4px] font-mono sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="label-caps text-sm">Keyboard</DialogTitle>
        <DialogDescription className="text-xs">
          Shortcuts work anywhere in the Studio except while typing in a field.
        </DialogDescription>
      </DialogHeader>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-xs">
        {SHORTCUTS.map((shortcut) => (
          <div key={shortcut.label} className="contents">
            <dt>
              <KbdGroup>
                {shortcut.keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </KbdGroup>
            </dt>
            <dd className="text-foreground/85">{shortcut.label}</dd>
          </div>
        ))}
      </dl>
      <div>
        <p className="label-caps text-muted-foreground mb-2">Charsets</p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          {CHARSET_NAMES.map((name, index) => (
            <div key={name} className="flex items-center gap-2">
              <dt>
                <Kbd>{charsetShortcut(index)}</Kbd>
              </dt>
              <dd className="text-foreground/85 truncate">
                {CHARSETS[name].label}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </DialogContent>
  </Dialog>
);
