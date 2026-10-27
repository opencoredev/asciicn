import { Sparkline } from "@/components/asciicn/sparkline";

const P95 = [
  212, 208, 215, 221, 219, 230, 248, 262, 241, 226, 218, 214, 209, 211, 207,
  204, 206, 201, 199, 203,
];
const ERRORS = [3, 2, 4, 3, 5, 9, 14, 11, 6, 4, 3, 2, 2, 3, 2, 1, 2, 1, 1, 1];

export default function SparklineLine() {
  return (
    <p className="text-muted-foreground max-w-md font-mono text-sm leading-7">
      p95 latency settled at <span className="text-foreground">203 ms</span>{" "}
      <Sparkline
        data={P95}
        label="p95 latency, last 20 deploys"
        glyphs="braille"
        color="blue"
      />{" "}
      after the cache fix, and errors fell back to{" "}
      <span className="text-foreground">1 a minute</span>{" "}
      <Sparkline
        data={ERRORS}
        label="Errors per minute, last 20 deploys"
        color="red"
        width={12}
      />
      .
    </p>
  );
}
