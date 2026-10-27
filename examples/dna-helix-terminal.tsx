import { DnaHelix } from "@/components/asciicn/dna-helix";

export default function DnaHelixTerminal() {
  return (
    <div className="w-full max-w-xl border bg-background font-mono text-xs">
      <div className="flex items-center justify-between border-b px-3 py-1.5 text-muted-foreground">
        <span>~/lab $ helix --seq GATTACA</span>
        <span>7 bp</span>
      </div>
      <DnaHelix
        orientation="horizontal"
        sequence="GATTACA"
        charset="standard"
        baseColors={{ A: "red", C: "purple", G: "orange", T: "blue" }}
        speed={-0.8}
        cell={11}
        className="aspect-[2/1] w-full"
      />
    </div>
  );
}
