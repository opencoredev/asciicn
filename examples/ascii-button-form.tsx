"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { AsciiButton } from "@/components/asciicn/ascii-button";

export default function AsciiButtonForm() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    window.setTimeout(() => {
      setSaving(false);
      setSaved(true);
    }, 1800);
  };

  return (
    <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1.5 font-mono text-sm">
        <span className="text-muted-foreground">Project name</span>
        <input
          name="project"
          defaultValue="northwind-api"
          autoComplete="off"
          className="h-9 rounded-md border bg-background px-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>
      <div className="flex items-center justify-end gap-4">
        <span role="status" className="font-mono text-xs text-muted-foreground">
          {saved ? "saved" : ""}
        </span>
        <AsciiButton type="button" variant="ghost" size="sm" disabled={saving}>
          Cancel
        </AsciiButton>
        <AsciiButton type="submit" size="sm" loading={saving} spinner="orbit">
          {saving ? "Saving" : "Save"}
        </AsciiButton>
      </div>
    </form>
  );
}
