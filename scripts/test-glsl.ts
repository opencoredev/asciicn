import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import { createJiti } from "jiti";

import type * as AtlasModule from "../lib/ascii/atlas";
import {
  describeCompileLog,
  fieldShader,
  withoutSharedHelpers,
} from "../lib/ascii/glsl";

// atlas.ts imports through the `@/` alias, which plain jiti doesn't know.
const root = fileURLToPath(new URL("..", import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@/": root } });
const { rampLevel, rampPositions } = await jiti.import<typeof AtlasModule>(
  "../lib/ascii/atlas.ts"
);

// `field` and `colorField` compile into one shader. These cases pin down
// which definitions the engine may drop from `colorField` as duplicates,
// how compile errors point back at the caller's code, and the ramp
// mapping the GPU shares with `mapTones`.
// Run with `pnpm test`.

const cases: [string, () => void][] = [];
const test = (name: string, run: () => void) => {
  cases.push([name, run]);
};

const COLOR =
  "vec3 colorField(vec2 uv, vec2 res, float t) { return vec3(1.0); }";

const same = (actual: string, expected: string) =>
  assert.equal(
    actual.replaceAll(/\s+/g, " ").trim(),
    expected.replaceAll(/\s+/g, " ").trim()
  );

test("drops a helper prepended to both", () => {
  const helpers =
    "// shared\nfloat ring(vec2 p) { return abs(length(p) - 0.3); }\n";
  same(
    withoutSharedHelpers(
      `${helpers}float field() { return 1.0; }`,
      `${helpers}${COLOR}`
    ),
    COLOR
  );
});

test("keeps a different helper with the same name", () => {
  const color = `float ring(vec2 p) { return 0.0; }\n${COLOR}`;
  same(
    withoutSharedHelpers("float ring(vec2 p) { return 1.0; }", color),
    color
  );
});

test("ignores comments and spacing", () => {
  same(
    withoutSharedHelpers(
      "float a(float x){return x;}",
      `/* doc */ float a(float x) {\n  return x; // same\n}\n${COLOR}`
    ),
    COLOR
  );
});

test("matches member access with or without spaces", () => {
  same(
    withoutSharedHelpers(
      "float h(vec2 p){return p.x;}",
      `float h(vec2 p){return p . x;}\n${COLOR}`
    ),
    COLOR
  );
});

test("keeps operators that only differ in spacing", () => {
  const color = `float g(float a, float b){return a++ +b;}\n${COLOR}`;
  same(
    withoutSharedHelpers("float g(float a, float b){return a + ++b;}", color),
    color
  );
});

test("keeps numbers whole", () => {
  same(
    withoutSharedHelpers(
      "const float K = 1e-4;",
      `const float K = 1e-4;\n${COLOR}`
    ),
    COLOR
  );
  const color = `const float K = 1.5;\n${COLOR}`;
  same(withoutSharedHelpers("const float K = 1.0;", color), color);
});

test("keeps precision statements", () => {
  const color = `precision highp float;\n${COLOR}`;
  same(
    withoutSharedHelpers(
      "precision highp float;\nprecision mediump float;",
      color
    ),
    color
  );
});

test("leaves sources with directives alone", () => {
  const color = `#define PI 3.14159\nfloat h(float x){return x;}\n${COLOR}`;
  assert.equal(
    withoutSharedHelpers(
      "#define PI 3.14159\nfloat h(float x){return x;}",
      color
    ),
    color
  );
  const after = `float h(){return 0.5;}\n${COLOR}`;
  assert.equal(
    withoutSharedHelpers("/*c*/ #if 0\nfloat h(){return 0.5;}\n#endif", after),
    after
  );
});

test("keeps struct declarations whole", () => {
  const color = `struct {float x;} b;\n${COLOR}`;
  same(withoutSharedHelpers("struct {float x;} a;", color), color);
  same(
    withoutSharedHelpers(
      "struct S {float x;};",
      `struct S {float x;};\n${COLOR}`
    ),
    COLOR
  );
});

test("ends line comments at a carriage return", () => {
  same(
    withoutSharedHelpers("float q(){return 1.0;}", `// note\r${COLOR}`),
    COLOR
  );
});

test("even ramp positions match the mapTones rule", () => {
  for (const count of [2, 4, 10, 70]) {
    const positions = rampPositions(() => 0, count);
    for (let step = 0; step <= 200; step += 1) {
      const tone = step / 200;
      for (const cut of [0.5, 0.1, 0.9]) {
        // Float32 positions may round differently exactly on a boundary.
        const level = tone * (count - 1) + cut;
        if (Math.abs(level - Math.round(level)) < 1e-4) {
          continue;
        }
        assert.equal(
          rampLevel(tone, positions, cut),
          Math.min(count - 1, Math.floor(tone * (count - 1) + cut)),
          `n=${count} tone=${tone} cut=${cut}`
        );
      }
    }
  }
});

test("calibrated ramp positions rise strictly and span 0 to 1", () => {
  // A font where two neighbours ink the same and one inks less than the last.
  const coverage = [0, 0.05, 0.05, 0.3, 0.2, 0.45];
  const positions = rampPositions((index) => coverage[index] ?? 0, 6);
  assert.equal(positions[0], 0);
  assert.equal(positions[5], 1);
  for (let index = 1; index < positions.length; index += 1) {
    assert.ok((positions[index] ?? 0) > (positions[index - 1] ?? 0));
  }
  // Every glyph is still reachable.
  const seen = new Set<number>();
  for (let step = 0; step <= 1000; step += 1) {
    seen.add(rampLevel(step / 1000, positions));
  }
  assert.equal(seen.size, 6);
});

test("compile errors point at the field's own line", () => {
  const field = "float field(vec2 uv, vec2 res, float t) {\n  return oops;\n}";
  const { fieldLine, colorLine } = fieldShader({
    colorField: undefined,
    field,
    uniforms: "",
  });
  const message = describeCompileLog({
    colorField: undefined,
    colorLine,
    field,
    fieldLine,
    log: `ERROR: 0:${fieldLine + 2}: 'oops' : undeclared identifier`,
  });
  assert.match(message, /field line 2: 'oops'/);
  assert.match(message, /> return oops;/);
});

test("the field source starts on the reported line", () => {
  const field = "float field(vec2 uv, vec2 res, float t) { return 0.5; }";
  const built = fieldShader({ colorField: COLOR, field, uniforms: "" });
  const lines = built.source.split("\n");
  assert.equal(lines[built.fieldLine], field);
  assert.equal(lines[built.colorLine], COLOR);
});

let failed = 0;
for (const [name, run] of cases) {
  try {
    run();
    process.stdout.write(`ok   ${name}\n`);
  } catch (error) {
    failed += 1;
    process.stdout.write(`FAIL ${name}\n${String(error)}\n`);
  }
}
process.stdout.write(`${cases.length - failed}/${cases.length} passed\n`);
process.exitCode = failed > 0 ? 1 : 0;
