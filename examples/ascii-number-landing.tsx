import { AsciiNumber } from "@/components/asciicn/ascii-number";

export default function AsciiNumberLanding() {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <AsciiNumber
        value={12_480}
        prefix="+"
        font="box"
        cell={22}
        duration={2.2}
        ghost
        color="green"
      />
      <p className="max-w-xs text-sm text-balance text-muted-foreground">
        teams shipped with asciicn this year
      </p>
    </div>
  );
}
