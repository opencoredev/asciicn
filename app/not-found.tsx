import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { Prompt } from "@/components/terminal/prompt";
import { StatusBar, StatusItem } from "@/components/terminal/status-bar";
import { ROUTES } from "@/constants/routes";

// A 404 laid out as a glyph cell grid with nothing drawn in it.
const EMPTY_FRAME = [
  "┌──────────────────────────────┐",
  "│                              │",
  "│   4 0 4   ·   no such page   │",
  "│                              │",
  "└──────────────────────────────┘",
].join("\n");

const NotFound = () => (
  <div className="bg-background flex min-h-svh flex-col">
    <SiteHeader />
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
      <pre
        aria-hidden
        className="text-muted-foreground font-mono text-[13px] leading-[1.2] sm:text-base"
      >
        {EMPTY_FRAME}
      </pre>
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <h1 className="font-display text-2xl font-medium tracking-[-0.03em] [font-stretch:87.5%]">
          Page not found
        </h1>
        <p className="text-muted-foreground font-sans text-sm text-pretty">
          The address may have changed. Start from the docs, or search with{" "}
          <span className="font-mono">⌘K</span>.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link
          href={ROUTES.DOCS}
          className="bg-primary text-primary-foreground hover:bg-primary/88 flex h-9 items-center rounded-xs px-3.5 font-mono text-[13px] transition-colors duration-150"
        >
          Read the docs
        </Link>
        <Link
          href={ROUTES.HOME}
          className="border-rule hover:bg-accent flex h-9 items-center rounded-xs border px-3.5 font-mono text-[13px] transition-colors duration-150"
        >
          Go home
        </Link>
      </div>
      <Prompt
        command="npx shadcn@latest add @asciicn/not-found"
        size="sm"
        className="max-w-md"
      />
    </main>
    <StatusBar
      size="md"
      className="px-4"
      left={<StatusItem value="404" tone="warn" />}
      right={<StatusItem label="route" value="unmatched" tone="muted" />}
    />
  </div>
);

export default NotFound;
