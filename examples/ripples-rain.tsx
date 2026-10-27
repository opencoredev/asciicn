import { Ripples } from "@/components/asciicn/ripples";

export default function RipplesRain() {
  return (
    <Ripples
      sources={[
        [0.18, 0.3],
        [0.62, 0.22],
        [0.4, 0.72],
        [0.86, 0.68],
      ]}
      rings={16}
      decay={2.2}
      charset="dots"
      colorMode="duotone"
      ramp="glacier"
      className="absolute inset-0"
    />
  );
}
