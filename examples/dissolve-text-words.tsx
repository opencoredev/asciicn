import { DissolveText } from "@/components/asciicn/dissolve-text";

export default function DissolveTextWords() {
  return (
    <DissolveText
      as="p"
      by="word"
      order="random"
      duration={0.6}
      stagger={0.09}
      color="grey"
      className="max-w-lg text-center text-lg text-balance text-muted-foreground"
    >
      Real glyphs, crisp at any zoom, copyable, and readable by screen readers
      from the first frame to the last.
    </DissolveText>
  );
}
