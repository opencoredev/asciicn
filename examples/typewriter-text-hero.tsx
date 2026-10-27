import { TypewriterText } from "@/components/asciicn/typewriter-text";

export default function TypewriterTextHero() {
  return (
    <h3 className="font-display w-full max-w-2xl text-4xl leading-tight font-bold tracking-tight sm:text-6xl">
      Interfaces that
      <br />
      <TypewriterText
        phrases={["render in glyphs", "boot like a terminal", "ship today"]}
        cursor="underscore"
        speed={12}
        pause={2.2}
        cursorColor="orange"
      />
    </h3>
  );
}
