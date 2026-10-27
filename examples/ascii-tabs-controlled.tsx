"use client";

import { useState } from "react";

import { AsciiTabs } from "@/components/asciicn/ascii-tabs";
import type { AsciiTab } from "@/components/asciicn/ascii-tabs";

const ROUTES = ["/", "/docs", "/studio", "/backgrounds"] as const;

const TABS: readonly AsciiTab[] = [
  {
    content: (
      <p className="text-muted-foreground text-sm">
        412 errors in the last 24 hours, most from{" "}
        <span className="text-foreground font-mono">/studio</span>.
      </p>
    ),
    label: "Errors",
    value: "errors",
  },
  {
    content: (
      <ul className="text-muted-foreground flex flex-col gap-1 font-mono text-xs">
        {ROUTES.map((route) => (
          <li key={route}>GET {route} 200</li>
        ))}
      </ul>
    ),
    label: "Requests",
    value: "requests",
  },
  {
    content: (
      <p className="text-muted-foreground text-sm">
        No slow queries this week.
      </p>
    ),
    label: "Queries",
    value: "queries",
  },
];

export default function AsciiTabsControlled() {
  const [tab, setTab] = useState("requests");
  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <AsciiTabs
        tabs={TABS}
        value={tab}
        onValueChange={setTab}
        label="Logs"
        color="blue"
        size="sm"
      />
      <p className="text-muted-foreground font-mono text-xs">
        value: <span className="text-foreground">{`"${tab}"`}</span>
      </p>
    </div>
  );
}
