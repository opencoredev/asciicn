import { RetroComputer } from "@/components/asciicn/retro-computer";

const SCRIPT = [
  {
    command: "npx shadcn add retro-computer",
    output: ["+ components/asciicn/retro-computer.tsx", "done."],
  },
  {
    command: "pnpm dev",
    output: ["ready on http://localhost:3000"],
  },
];

export default function RetroComputerSession() {
  return (
    <RetroComputer
      script={SCRIPT}
      banner={["ACME OS 2.1", ""]}
      prompt="$ "
      screen="p1"
      className="aspect-[4/3] w-full max-w-xl"
    />
  );
}
