"use client";

import { useEffect, useState } from "react";

import { DissolveText } from "@/components/asciicn/dissolve-text";

const WORDS = ["terminals", "dashboards", "landing pages", "status bars"];

export default function DissolveTextCycle() {
  const [index, setIndex] = useState(0);
  const [show, setShow] = useState(true);

  // Hold, dissolve, then swap the word and assemble the next one.
  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        if (show) {
          setShow(false);
        } else {
          setIndex((value) => (value + 1) % WORDS.length);
          setShow(true);
        }
      },
      show ? 2000 : 700
    );
    return () => window.clearTimeout(timer);
  }, [show]);

  return (
    <p className="font-display text-2xl font-bold tracking-tight sm:text-4xl">
      Glyphs for{" "}
      <DissolveText
        show={show}
        trigger="mount"
        charset="braille"
        order="center"
        color="purple"
        className="text-[var(--ascii-color-purple)]"
      >
        {WORDS[index] ?? ""}
      </DissolveText>
    </p>
  );
}
