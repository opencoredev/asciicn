import { TorusKnot } from "@/components/asciicn/torus-knot";

export default function TorusKnotBraille() {
  return (
    <TorusKnot
      p={3}
      q={4}
      thickness={0.17}
      charset="braille"
      hue="tube"
      colors={["orange", "pink", "purple"]}
      spin={0.6}
      cell={12}
      className="aspect-square w-full max-w-md"
    />
  );
}
