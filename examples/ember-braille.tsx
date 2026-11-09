import { Ember } from "@/components/asciicn/ember";

export default function EmberBraille() {
  return (
    <Ember
      charset="braille"
      intensity={1.1}
      sparks={0.6}
      cell={12}
      className="absolute inset-0"
    />
  );
}
