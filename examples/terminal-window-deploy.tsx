import { TerminalWindow } from "@/components/asciicn/terminal-window";
import type { TerminalStep } from "@/components/asciicn/terminal-window";

// A deploy that hits a failing check, gets fixed and ships.
const DEPLOY: readonly TerminalStep[] = [
  { kind: "command", text: "git push origin main" },
  {
    kind: "output",
    text: "To github.com:acme/web.git\n   8e52937..4f2a1c9  main -> main",
    tone: "muted",
  },
  { kind: "command", text: "acme deploy --prod" },
  { duration: 1, kind: "task", text: "Running checks" },
  {
    kind: "output",
    text: "Contrast 3.9:1 on .badge-muted, needs 4.5:1",
    tone: "error",
  },
  { kind: "output", text: "1 check failed. Deploy stopped.", tone: "muted" },
  { kind: "command", text: "acme deploy --prod --skip a11y" },
  {
    kind: "output",
    text: "Skipping a11y checks for this deploy only",
    tone: "warn",
  },
  { duration: 1.6, kind: "progress", label: "Uploading 96 files", width: 16 },
  {
    done: "Live in 31 regions",
    duration: 1.2,
    kind: "task",
    text: "Propagating",
  },
  { kind: "output", text: "https://acme.dev  (4f2a1c9)", tone: "info" },
];

export default function TerminalWindowDeploy() {
  return (
    <TerminalWindow
      script={DEPLOY}
      title="~/acme/web — deploy"
      rows={12}
      size="md"
      frame="light"
      className="max-w-xl"
    />
  );
}
