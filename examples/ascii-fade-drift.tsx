import { AsciiFade } from "@/components/asciicn/ascii-fade";

export default function AsciiFadeDrift() {
  return (
    <div className="relative size-full overflow-hidden">
      <div className="bg-primary absolute inset-0" />
      <AsciiFade side="top" size="70%" animate matrix="bayer8" cell={4} />
    </div>
  );
}
