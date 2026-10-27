"use client";

import { useState } from "react";

import { AsciiBox } from "@/components/asciicn/ascii-box";
import { AsciiButton } from "@/components/asciicn/ascii-button";

const LINES = [
  "$ asciicn add ascii-box",
  "✓ resolved 2 items",
  "✓ wrote components/asciicn/ascii-box.tsx",
  "✓ wrote lib/ascii/index.ts",
  "done in 0.42s",
];

export default function AsciiBoxFit() {
  const [count, setCount] = useState(2);
  return (
    <div className="flex flex-col items-center gap-6">
      <AsciiBox
        title="stdout"
        footer={`${count} lines`}
        frame="rounded"
        className="font-mono text-sm"
      >
        {LINES.slice(0, count).map((line) => (
          <p key={line}>{line}</p>
        ))}
      </AsciiBox>
      <AsciiButton
        variant="outline"
        size="sm"
        onClick={() => setCount((value) => (value % LINES.length) + 1)}
      >
        {count === LINES.length ? "Reset" : "Next line"}
      </AsciiButton>
    </div>
  );
}
