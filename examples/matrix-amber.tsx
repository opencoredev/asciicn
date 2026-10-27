import { Matrix } from "@/components/asciicn/matrix";

export default function MatrixAmber() {
  return (
    <Matrix
      charset="cp437"
      colorMode="mono"
      phosphor="p3"
      length={22}
      mutation={7}
      fx={{ bloom: 0.5, scanlines: 0.4 }}
      className="absolute inset-0"
    />
  );
}
