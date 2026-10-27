import { Matrix } from "@/components/asciicn/matrix";

export default function MatrixBraille() {
  return (
    <Matrix
      charset="braille"
      color="blue"
      density={0.85}
      length={10}
      cell={10}
      className="absolute inset-0"
    />
  );
}
