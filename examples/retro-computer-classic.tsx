import { RetroComputer } from "@/components/asciicn/retro-computer";

export default function RetroComputerClassic() {
  return (
    <RetroComputer
      charset="standard"
      screen="ibm"
      color="--ascii-ink"
      cell={12}
      fx={{ bloom: 0.35, vignette: 0.3 }}
      className="aspect-[4/3] w-full max-w-xl"
    />
  );
}
