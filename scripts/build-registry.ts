/**
 * Builds registry.json from registry/base.json plus one fragment per catalog
 * group (registry/<group>.json, each a JSON array of shadcn registry items),
 * then checks the result before `shadcn build` turns it into public/r.
 *
 * registry.json is generated and gitignored: edit the fragments instead.
 * `{{REGISTRY_URL}}` becomes `<origin>/r`, with the origin from
 * `getRegistryOrigin` in constants/site.ts.
 *
 * Run with `pnpm registry:build`.
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getRegistryOrigin } from "../constants/site";
import {
  renderSkillFile,
  skillFiles,
} from "../lib/agent-discovery/asciicn-skill";

const ROOT = process.cwd();
const REGISTRY_DIR = path.join(ROOT, "registry");
const PLACEHOLDER = "{{REGISTRY_URL}}";
// Same rule as the docs' install commands: SITE_URL, else on Vercel the
// production domain or the preview's own deployment, else localhost.
const SITE_URL = getRegistryOrigin();
const REGISTRY_URL = `${SITE_URL}/r`;

// The agent skill, rendered for SITE_URL, is what the asciicn-skill item ships.
const SKILL_OUT = path.join(ROOT, ".generated", "skills", "asciicn");
for (const file of skillFiles()) {
  const target = path.join(SKILL_OUT, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, renderSkillFile(file, SITE_URL) ?? "");
}

// Site-only modules a shipped file must never import: users don't have them.
const FORBIDDEN_IMPORTS = [
  "@/constants",
  "@/components/icon",
  "@/hooks/",
  "@/examples/",
  "@hugeicons/",
] as const;

// Modules that belong to the ascii-shader item rather than ascii-core.
const GPU_MODULES: readonly string[] = [
  "@/lib/ascii/shader",
  "@/lib/ascii/gpu",
  "@/lib/ascii/glsl",
  "@/lib/ascii/seed",
];

interface RegistryFile {
  path: string;
  type: string;
  target?: string;
}

interface RegistryItem {
  name: string;
  type: string;
  files?: RegistryFile[];
  registryDependencies?: string[];
  [key: string]: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFile = (value: unknown): value is RegistryFile =>
  isRecord(value) &&
  typeof value.path === "string" &&
  typeof value.type === "string";

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const parseItem = (value: unknown, source: string): RegistryItem => {
  if (
    !isRecord(value) ||
    typeof value.name !== "string" ||
    typeof value.type !== "string"
  ) {
    throw new Error(`${source}: every item needs a string "name" and "type"`);
  }
  const { files, registryDependencies } = value;
  if (
    files !== undefined &&
    !(Array.isArray(files) && files.every((file) => isFile(file)))
  ) {
    throw new Error(`${source}: "${value.name}" has malformed "files"`);
  }
  if (
    registryDependencies !== undefined &&
    !isStringArray(registryDependencies)
  ) {
    throw new Error(
      `${source}: "${value.name}" has malformed "registryDependencies"`
    );
  }
  return {
    ...value,
    files,
    name: value.name,
    registryDependencies,
    type: value.type,
  };
};

const readFragment = (file: string): RegistryItem[] => {
  const source = path.join("registry", file);
  const parsed: unknown = JSON.parse(
    readFileSync(path.join(REGISTRY_DIR, file), "utf-8")
  );
  if (!Array.isArray(parsed)) {
    throw new TypeError(`${source}: must be a JSON array of registry items`);
  }
  return parsed.map((item) => parseItem(item, source));
};

const fragments = readdirSync(REGISTRY_DIR)
  .filter((file) => file.endsWith(".json") && file !== "base.json")
  .toSorted();
const items = ["base.json", ...fragments].flatMap((file) =>
  readFragment(file).map((item) => ({ file, item }))
);

const errors: string[] = [];

const seen = new Map<string, string>();
for (const { file, item } of items) {
  const previous = seen.get(item.name);
  if (previous) {
    errors.push(
      `duplicate item "${item.name}" in registry/${previous} and registry/${file}`
    );
  }
  seen.set(item.name, file);
}

const IMPORT_PATTERN =
  /from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

for (const { file, item } of items) {
  const dependencies = new Set(item.registryDependencies);
  // Markdown and other plain files hold example code, not imports to check.
  const codeFiles = (item.files ?? []).filter((entry) =>
    /\.(?:ts|tsx|js|jsx)$/.test(entry.path)
  );
  for (const entry of codeFiles) {
    let code: string;
    try {
      code = readFileSync(path.join(ROOT, entry.path), "utf-8");
    } catch {
      errors.push(
        `registry/${file}: "${item.name}" lists missing file ${entry.path}`
      );
      continue;
    }
    for (const match of code.matchAll(IMPORT_PATTERN)) {
      const specifier = match[1] ?? match[2] ?? "";
      const where = `registry/${file}: "${item.name}" (${entry.path}) imports "${specifier}"`;
      if (FORBIDDEN_IMPORTS.some((prefix) => specifier.startsWith(prefix))) {
        errors.push(`${where}, a site-only module`);
      }
      const component = /^@\/components\/asciicn\/(?:scenes\/)?([^/]+)/.exec(
        specifier
      )?.[1];
      if (component && !dependencies.has(`${PLACEHOLDER}/${component}.json`)) {
        errors.push(
          `${where} without "${PLACEHOLDER}/${component}.json" in registryDependencies`
        );
      }
      // The GPU renderer is its own item, so CPU-only pieces never ship WebGL.
      const gpu = GPU_MODULES.some((module) => specifier === module);
      if (
        gpu &&
        item.name !== "ascii-shader" &&
        !dependencies.has(`${PLACEHOLDER}/ascii-shader.json`)
      ) {
        errors.push(
          `${where} without "${PLACEHOLDER}/ascii-shader.json" in registryDependencies`
        );
      }
      if (
        !gpu &&
        specifier.startsWith("@/lib/ascii") &&
        !["ascii-core", "ascii-shader"].includes(item.name) &&
        !dependencies.has(`${PLACEHOLDER}/ascii-core.json`) &&
        !dependencies.has(`${PLACEHOLDER}/ascii-shader.json`)
      ) {
        errors.push(
          `${where} without "${PLACEHOLDER}/ascii-core.json" in registryDependencies`
        );
      }
    }
  }
  for (const dependency of dependencies) {
    if (dependency.startsWith(PLACEHOLDER)) {
      const name = /\/([^/]+)\.json$/.exec(dependency)?.[1];
      if (!name || !seen.has(name)) {
        errors.push(
          `registry/${file}: "${item.name}" depends on "${dependency}", which no fragment defines`
        );
      }
    }
  }
}

// The asciicn-skill item must ship every skill file to both skill folders.
const skillItem = items.find(({ item }) => item.name === "asciicn-skill");
const shipped = new Set(skillItem?.item.files?.map((file) => file.target));
for (const folder of [".agents/skills/asciicn", ".claude/skills/asciicn"]) {
  for (const file of skillFiles()) {
    if (!shipped.has(`${folder}/${file}`)) {
      errors.push(
        `registry/engine.json: "asciicn-skill" is missing ${folder}/${file}`
      );
    }
  }
}

// Examples without "use client" run on the server: controls files (the MDX
// page passes `controls` to the preview frame) and server-rendered demos.
// A "use client" module's exports are client references there, so a value
// such as an option list breaks prerendering. Components (PascalCase) render
// fine. Import types only and copy the values (checked with
// `satisfies typeof`), or mark the example "use client".
const VALUE_IMPORT =
  /^import\s+(?!type\b)\{([^}]*)\}\s+from\s+["'](@\/[^"']+)["']/gm;
const isClientModule = (specifier: string) =>
  [".tsx", ".ts"].some((extension) => {
    try {
      const head = readFileSync(
        path.join(ROOT, `${specifier.replace("@/", "")}${extension}`),
        "utf-8"
      ).trimStart();
      return head.startsWith('"use client"') || head.startsWith("'use client'");
    } catch {
      return false;
    }
  });
const COMPONENT_NAME = /^[A-Z][a-z]/;
for (const file of readdirSync(path.join(ROOT, "examples"))) {
  if (!/\.tsx?$/.test(file)) {
    continue;
  }
  const code = readFileSync(path.join(ROOT, "examples", file), "utf-8");
  const head = code.trimStart();
  if (head.startsWith('"use client"') || head.startsWith("'use client'")) {
    continue;
  }
  for (const match of code.matchAll(VALUE_IMPORT)) {
    const names = (match[1] ?? "")
      .split(",")
      .map((name) => name.trim())
      .filter(
        (name) =>
          name !== "" && !name.startsWith("type ") && !COMPONENT_NAME.test(name)
      );
    const specifier = match[2] ?? "";
    if (names.length > 0 && isClientModule(specifier)) {
      errors.push(
        `examples/${file} imports ${names.join(", ")} from the "use client" module ${specifier}; it runs on the server, so import types only and copy the values, or mark it "use client"`
      );
    }
  }
}

const registry = {
  $schema: "https://ui.shadcn.com/schema/registry.json",
  homepage: SITE_URL,
  items: items.map(({ item }) => item),
  name: "asciicn",
};

const output = `${JSON.stringify(registry, null, 2).replaceAll(PLACEHOLDER, REGISTRY_URL)}\n`;
const leftover = /\{\{[A-Z_]+\}\}/.exec(output);
if (leftover) {
  errors.push(`unreplaced placeholder ${leftover[0]} in registry.json`);
}

if (errors.length > 0) {
  process.stderr.write(
    `registry:build failed:\n${errors.map((error) => `  - ${error}`).join("\n")}\n`
  );
  process.exit(1);
}

writeFileSync(path.join(ROOT, "registry.json"), output);
process.stdout.write(
  `registry.json: ${items.length} items from ${fragments.length + 1} files, URLs at ${REGISTRY_URL}\n`
);
