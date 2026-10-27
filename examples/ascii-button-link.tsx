import Link from "next/link";

import { AsciiButton } from "@/components/asciicn/ascii-button";

export default function AsciiButtonLink() {
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
      <div className="flex flex-col gap-2">
        <span className="font-display text-2xl font-semibold tracking-tight text-balance">
          Glyph components for your next launch
        </span>
        <span className="text-sm text-muted-foreground">
          Copy them in with the shadcn CLI. Own the code.
        </span>
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        <AsciiButton asChild size="lg">
          <Link href="/docs/installation">Install asciicn</Link>
        </AsciiButton>
        <AsciiButton asChild size="lg" variant="outline" frame="brackets">
          <Link href="/docs/examples">See the examples</Link>
        </AsciiButton>
      </div>
    </div>
  );
}
