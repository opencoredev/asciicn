import { TypewriterText } from "@/components/asciicn/typewriter-text";

const LINES = [
  { delay: 0.2, text: "BIOS 4.02 · memory check 65536K ok" },
  { delay: 1.8, text: "mounting /dev/glyph0 on /usr/share/ascii" },
  { delay: 3.8, text: "starting asciicn renderer ... done" },
] as const;

export default function TypewriterTextBoot() {
  return (
    <div className="flex w-full max-w-xl flex-col gap-1 font-mono text-xs text-muted-foreground sm:text-sm">
      {LINES.map((line) => (
        <TypewriterText
          key={line.text}
          as="p"
          phrases={[line.text]}
          loop={false}
          speed={34}
          jitter={0.3}
          delay={line.delay}
          cursor="bar"
          showCursor="typing"
        />
      ))}
      <TypewriterText
        as="p"
        phrases={["ready."]}
        loop={false}
        delay={5.4}
        speed={10}
        showCursor="started"
        className="text-foreground"
      />
    </div>
  );
}
