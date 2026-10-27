import { Loader } from "@/components/asciicn/loader";
import type { LoaderProps } from "@/components/asciicn/loader";

const ROWS: readonly { name: string; props: LoaderProps }[] = [
  { name: "orbit", props: { spinner: "orbit" } },
  { name: "braille", props: { spinner: "braille" } },
  { name: "arc", props: { spinner: "arc" } },
  { name: "tick", props: { spinner: "tick" } },
  { name: "bar", props: { spinner: "bar" } },
  { name: "quadrant", props: { spinner: "quadrant" } },
  { name: "dots", props: { variant: "dots" } },
  { name: "wave", props: { variant: "wave" } },
  { name: "comet", props: { variant: "comet" } },
];

export default function LoaderVariants() {
  return (
    <ul className="grid w-full max-w-lg grid-cols-3 gap-px overflow-hidden rounded-lg border bg-[var(--border)]">
      {ROWS.map((row) => (
        <li
          key={row.name}
          className="bg-background flex flex-col items-center gap-2 px-3 py-5"
        >
          <Loader size="lg" label={`Loading, ${row.name}`} {...row.props} />
          <span className="text-muted-foreground font-mono text-xs">
            {row.name}
          </span>
        </li>
      ))}
    </ul>
  );
}
