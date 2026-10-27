import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";
import vitest from "ultracite/oxlint/vitest";

export default defineConfig({
  extends: [core, react, next, vitest],
  ignorePatterns: [
    "public/r/**",
    ".agents/**",
    ".cursor/**",
    ".changeset/**",
    ".claude/**",
  ],
  // Glyph masks (Braille dots, quadrants) and seeded hashes are bit fields.
  overrides: [{ files: ["lib/ascii/**"], rules: { "no-bitwise": "off" } }],
});
