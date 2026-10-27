import assert from "node:assert/strict";
import path from "node:path";

import { createJiti } from "jiti";

import type * as Atlas from "../lib/ascii/atlas";
import type * as Charsets from "../lib/ascii/charsets";
import type * as Exporter from "../lib/ascii/export";
import type * as Frames from "../lib/ascii/frame";
import type * as Glyphs from "../lib/ascii/glyphs";
import type * as Paint from "../lib/ascii/paint";
import type * as Palettes from "../lib/ascii/palettes";
import type * as Shader from "../lib/ascii/shader";
import type * as Style from "../lib/ascii/style";

// The CPU engine: tone → glyph mapping, sub-cell masks, edge glyphs, the
// fill kit and the text, ANSI and SVG exporters. Run with `pnpm test`.

const root = path.resolve(import.meta.dirname, "..");
// Engine files import each other through the `@/` alias; resolve it here.
const jiti = createJiti(import.meta.url, {
  alias: { "@/": `${root}/` },
  jsx: true,
});

/**
 * The GLSL `rampLevel` in `lib/ascii/glsl.ts`, step for step (same
 * 12-step search cap), in float32 like the GPU.
 */
const gpuRampLevel = (
  tone: number,
  positions: Float32Array,
  cut: number
): number => {
  const f = Math.fround;
  const last = positions.length - 1;
  let low = 0;
  let high = last;
  for (let step = 0; step < 12 && high - low > 1; step += 1) {
    const mid = Math.trunc((low + high) / 2);
    if ((positions[mid] ?? 0) <= f(tone)) {
      low = mid;
    } else {
      high = mid;
    }
  }
  const from = positions[low] ?? 0;
  const to = positions[high] ?? 0;
  const level = f(low + (to > from ? f(f(f(tone) - from) / f(to - from)) : 0));
  return Math.min(last, Math.max(0, Math.floor(f(level + cut))));
};

const main = async () => {
  const charsets = await jiti.import<typeof Charsets>("@/lib/ascii/charsets");
  const frames = await jiti.import<typeof Frames>("@/lib/ascii/frame");
  const glyphs = await jiti.import<typeof Glyphs>("@/lib/ascii/glyphs");
  const style = await jiti.import<typeof Style>("@/lib/ascii/style");
  const exporter = await jiti.import<typeof Exporter>("@/lib/ascii/export");
  const atlas = await jiti.import<typeof Atlas>("@/lib/ascii/atlas");
  const paint = await jiti.import<typeof Paint>("@/lib/ascii/paint");
  const palettes = await jiti.import<typeof Palettes>("@/lib/ascii/palettes");
  const shader = await jiti.import<typeof Shader>("@/lib/ascii/shader");

  const { createToneField, fillToneField, mapTones, MutableFrame } = frames;

  const cases: [string, () => void][] = [];
  const test = (name: string, run: () => void) => {
    cases.push([name, run]);
  };

  /** A field for `columns` x `rows` cells with tones from a function of the sample (x, y). */
  const field = (
    columns: number,
    rows: number,
    charset: Parameters<typeof createToneField>[2],
    tone: (x: number, y: number) => number,
    color?: (x: number, y: number) => readonly [number, number, number]
  ) => {
    const result = createToneField(columns, rows, charset, {
      color: color !== undefined,
    });
    for (let y = 0; y < result.height; y += 1) {
      for (let x = 0; x < result.width; x += 1) {
        const index = y * result.width + x;
        result.tones[index] = tone(x, y);
        if (color && result.colors) {
          result.colors.set([...color(x, y), 255], index * 4);
        }
      }
    }
    return result;
  };

  // ------------------------------------------------------------ ramps

  test("ramp: tones pick the nearest level", () => {
    const tones = [0, 0.5, 1, 0.05, 0.95];
    const frame = mapTones(
      field(5, 1, "standard", (x) => tones[x] ?? 0),
      5,
      1
    );
    // " .:-=+*#%@": 0.5 * 9 + 0.5 = 5 → "+"; 0.05 → " "; 0.95 → "@".
    assert.equal(frames.frameToText(frame), " +@ @");
    assert.equal(frame.colors, null);
  });

  test("ramp: invert puts dense glyphs on dark tones", () => {
    const frame = mapTones(
      field(2, 1, "blocks", (x) => x),
      2,
      1,
      { charset: "blocks", invert: true }
    );
    assert.equal(frames.frameToText(frame), "█ ");
  });

  test("ramp: custom chars win over charset", () => {
    const frame = mapTones(
      field(3, 1, "standard", (x) => x / 2),
      3,
      1,
      { chars: " oO", charset: "dense" }
    );
    assert.equal(frames.frameToText(frame), " oO");
  });

  test("ramp: ordered dithering mixes two levels in proportion", () => {
    // Half a level above "." on the classic ramp (9 steps): half the cells
    // of a 4x4 Bayer tile draw ":" and half ".".
    const tone = 1.5 / 9;
    const frame = mapTones(
      field(4, 4, "standard", () => tone),
      4,
      4,
      {
        dither: "bayer4",
      }
    );
    const counts = new Map<string, number>();
    for (const glyph of frame.glyphs) {
      counts.set(glyph, (counts.get(glyph) ?? 0) + 1);
    }
    assert.equal(counts.get("."), 8);
    assert.equal(counts.get(":"), 8);
  });

  test("ramp: grade contrast pushes tones apart", () => {
    const frame = mapTones(
      field(2, 1, "blocks", (x) => (x === 0 ? 0.4 : 0.6)),
      2,
      1,
      { charset: "blocks", grade: { contrast: 4 } }
    );
    assert.deepEqual(frame.glyphs, [" ", "█"]);
  });

  test("ramp: positions make mapTones pick the GPU's level", () => {
    // Coverage like a real monospace font: uneven, with two near-equal
    // neighbours and one glyph lighter than the one before it.
    const denseCount = charsets.resolveCharset("dense").glyphs.length;
    const coverages = {
      dense: Array.from(
        { length: denseCount },
        (_, index) => (index / (denseCount - 1)) ** 1.7
      ),
      standard: [0, 0.03, 0.06, 0.07, 0.13, 0.12, 0.16, 0.3, 0.33, 0.4],
    } as const satisfies Partial<
      Record<Charsets.CharsetName, readonly number[]>
    >;
    const steps = 1000;
    for (const [name, coverage] of Object.entries(coverages)) {
      const charset = charsets.resolveCharset(
        name === "dense" ? "dense" : "standard"
      );
      assert.equal(charset.glyphs.length, coverage.length, name);
      const positions = atlas.rampPositions(
        (index) => coverage[index] ?? 0,
        coverage.length
      );
      const tones = field(steps + 1, 1, charset, (x) => x / steps);
      const calibrated = mapTones(tones, steps + 1, 1, {
        charset,
        positions,
      });
      const even = mapTones(tones, steps + 1, 1, { charset });
      let differs = 0;
      for (let step = 0; step <= steps; step += 1) {
        const expected =
          charset.glyphs[gpuRampLevel(step / steps, positions, 0.5)];
        assert.equal(
          calibrated.glyphs[step],
          expected,
          `${name} tone ${step / steps}`
        );
        if (even.glyphs[step] !== expected) {
          differs += 1;
        }
      }
      // Without positions the CPU really does disagree, so this test can fail.
      assert.ok(differs > 0, `${name}: even spacing should differ somewhere`);
    }
  });

  test("ramp: positions of the wrong length fall back to even spacing", () => {
    const tones = field(3, 1, "standard", (x) => x / 2);
    assert.deepEqual(
      mapTones(tones, 3, 1, { positions: [0, 1] }).glyphs,
      mapTones(tones, 3, 1).glyphs
    );
  });

  // ------------------------------------------------------------ GPU stops

  test("fitStops: long ramps resample to the GPU limit, ends exact", () => {
    const stops = Array.from(
      { length: 12 },
      (_, index) => [index / 11, 1 - index / 11, (index % 3) / 2, 1] as const
    );
    const fitted = shader.fitStops(stops);
    assert.equal(fitted.length, 8);
    assert.deepEqual(fitted[0], stops[0]);
    assert.deepEqual(fitted[7], stops[11]);
    // Each fitted stop is the original ramp sampled where it sits in t.
    const bytes = stops.map(([r, g, b]) => [r, g, b] as const);
    for (const [index, stop] of fitted.entries()) {
      const [r, g, b] = palettes.sampleRamp(bytes, index / 7);
      assert.ok(Math.abs(stop[0] - r) < 1e-9 && Math.abs(stop[1] - g) < 1e-9);
      assert.ok(Math.abs(stop[2] - b) < 1e-9, `stop ${index}`);
    }
    const short = stops.slice(0, 5);
    assert.deepEqual(shader.fitStops(short), short);
  });

  // ------------------------------------------------------------ painting

  test("paintFrame: clears before a translucent paper", () => {
    // A recording stand-in for the 2D context: only the calls paintFrame
    // makes before it needs real canvases (an empty frame stops there).
    const calls: string[] = [];
    const recorder = {
      canvas: { height: 4, width: 4 },
      clearRect: () => calls.push("clear"),
      fillRect: () => calls.push(`fill ${recorder.fillStyle}`),
      fillStyle: "",
      globalCompositeOperation: "source-over",
      setTransform: () => calls.push("transform"),
    };
    const metrics = {
      deviceHeight: 2,
      deviceWidth: 1,
      dpr: 1,
      font: "monospace",
      fontSize: 2,
      height: 2,
      width: 1,
    };
    const paper = "rgba(0, 0, 0, 0.5)";
    // The stand-in has only the members paintFrame touches on this path.
    const context = recorder as unknown as CanvasRenderingContext2D;
    paint.paintFrame(context, new MutableFrame(0, 0), metrics, {
      ink: "#fff",
      paper,
    });
    assert.deepEqual(calls, ["transform", "clear", `fill ${paper}`]);
  });

  // ------------------------------------------------------------ sub-cells

  test("braille: each sample owns its dot", () => {
    const only = (sx: number, sy: number) =>
      frames.frameToText(
        mapTones(
          field(1, 1, "braille", (x, y) => (x === sx && y === sy ? 1 : 0)),
          1,
          1,
          { charset: "braille" }
        )
      );
    assert.equal(only(0, 0), "⠁");
    assert.equal(only(0, 1), "⠂");
    assert.equal(only(1, 0), "⠈");
    assert.equal(only(0, 3), "⡀");
    assert.equal(only(1, 3), "⢀");
    assert.equal(only(9, 9), " ");
    const full = mapTones(
      field(1, 1, "braille", () => 1),
      1,
      1,
      {
        charset: "braille",
      }
    );
    assert.equal(full.glyphs[0], "⣿");
    assert.equal(charsets.brailleChar(255), "⣿");
  });

  test("braille: threshold sets which tones light a dot", () => {
    const frame = mapTones(
      field(1, 1, "braille", () => 0.4),
      1,
      1,
      {
        charset: "braille",
        threshold: 0.3,
      }
    );
    assert.equal(frame.glyphs[0], "⣿");
  });

  test("quadrants: masks map to the right blocks", () => {
    const quad = (lit: (x: number, y: number) => boolean) =>
      mapTones(
        field(1, 1, "quadrants", (x, y) => (lit(x, y) ? 1 : 0)),
        1,
        1,
        { charset: "quadrants" }
      ).glyphs[0];
    assert.equal(
      quad((x, y) => x === 1 && y === 0),
      "▝"
    );
    assert.equal(
      quad((_, y) => y === 1),
      "▄"
    );
    assert.equal(
      quad((x) => x === 0),
      "▌"
    );
    assert.equal(
      quad((x, y) => x === y),
      "▚"
    );
    assert.equal(charsets.quadrantChar(15), "█");
  });

  // ------------------------------------------------------------ edges

  test("edgeChar: glyph runs across the gradient", () => {
    assert.equal(charsets.edgeChar(1, 0), "|");
    assert.equal(charsets.edgeChar(-1, 0), "|");
    assert.equal(charsets.edgeChar(0, 1), "-");
    assert.equal(charsets.edgeChar(0, -1), "-");
    assert.equal(charsets.edgeChar(1, 1), "/");
    assert.equal(charsets.edgeChar(-1, -1), "/");
    assert.equal(charsets.edgeChar(1, -1), "\\");
  });

  test("edge charset: a vertical step draws |", () => {
    const frame = mapTones(
      field(6, 3, "edge", (x) => (x < 3 ? 0 : 1)),
      6,
      3,
      { charset: "edge" }
    );
    assert.equal(frame.get(2, 1), "|");
    assert.equal(frame.get(3, 1), "|");
    assert.equal(frame.get(0, 1), " ");
    assert.equal(frame.get(5, 1), "@");
  });

  // ------------------------------------------------------------ bars

  test("eighthsBar: partial cell at the end", () => {
    assert.equal(charsets.eighthsBar(0.55, 6), "███▎  ");
    assert.equal(charsets.eighthsBar(0, 3), "   ");
    assert.equal(charsets.eighthsBar(1, 3), "███");
    assert.equal(charsets.eighthsBar(2, 2), "██");
    assert.equal(charsets.eighthsBar(0.5, 1, charsets.EIGHTHS_UP), "▄");
  });

  // ------------------------------------------------------------ colour

  test("colour: truecolor averages the samples of a cell", () => {
    const frame = mapTones(
      field(
        1,
        1,
        "quadrants",
        () => 1,
        (x) => (x === 0 ? [200, 0, 0] : [0, 0, 100])
      ),
      1,
      1,
      { charset: "quadrants", colorMode: "truecolor" }
    );
    assert.deepEqual([...(frame.colors ?? [])], [100, 0, 50, 255]);
  });

  test("colour: ansi16 snaps to the table", () => {
    const frame = mapTones(
      field(
        2,
        1,
        "standard",
        () => 1,
        (x) => (x === 0 ? [200, 20, 10] : [160, 90, 10])
      ),
      2,
      1,
      { ansi: "vga", colorMode: "ansi16" }
    );
    // Red, then the VGA brown.
    assert.deepEqual(
      [...(frame.colors ?? [])],
      [170, 0, 0, 255, 170, 85, 0, 255]
    );
  });

  test("colour: duotone and palette read the tone", () => {
    const duo = mapTones(
      field(1, 1, "standard", () => 0),
      1,
      1,
      {
        colorMode: "duotone",
        ramp: ["#000000", "#ffffff"],
      }
    );
    assert.deepEqual([...(duo.colors ?? [])], [0, 0, 0, 255]);
    const pal = mapTones(
      field(1, 1, "standard", () => 1),
      1,
      1,
      {
        colorMode: "palette",
        palette: [
          [0, 0, 0],
          [10, 20, 30],
        ],
      }
    );
    assert.deepEqual([...(pal.colors ?? [])], [10, 20, 30, 255]);
  });

  test("fillToneField: [tone, r, g, b] fills colour", () => {
    const result = createToneField(1, 1, "standard", { color: true });
    fillToneField(result, () => [0.5, 1, 2, 3]);
    assert.equal(result.tones[0], 0.5);
    assert.deepEqual([...(result.colors ?? [])], [1, 2, 3, 255]);
  });

  test("MutableFrame: writes off the grid are ignored", () => {
    const frame = new MutableFrame(3, 1);
    frame.write(-1, 0, "abcd");
    frame.put(5, 5, "x");
    assert.equal(frames.frameToText(frame), "bcd");
  });

  // ------------------------------------------------------------ glyph geometry

  test("glyphs: geometric shapes", () => {
    assert.deepEqual(glyphs.glyphShape("█"), [
      { h: 1, kind: "rect", w: 1, x: 0, y: 0 },
    ]);
    assert.equal(glyphs.glyphShape("▚")?.length, 2);
    assert.equal(glyphs.glyphShape("⣿")?.length, 8);
    assert.equal(glyphs.glyphShape("⢕")?.length, 4);
    assert.equal(glyphs.glyphShape(" ")?.length, 0);
    assert.equal(glyphs.isGeometricGlyph("a"), false);
    assert.equal(glyphs.isGeometricGlyph("#"), false);
    assert.equal(glyphs.fillGlyphShape("#")?.length, 4);
    for (const glyph of charsets.QUADRANT_GLYPHS) {
      assert.ok(glyphs.isGeometricGlyph(glyph), glyph);
    }
    assert.equal(
      glyphs.glyphPath("█", { height: 12, width: 6, x: 0, y: 0 }),
      "M0 0h6v12h-6Z"
    );
  });

  // ------------------------------------------------------------ fill kit

  test("fill: ramps and levels", () => {
    const { shade } = style.GLYPH_RAMPS;
    assert.equal(style.rampGlyph(shade, 0.5), "▒");
    assert.equal(style.rampGlyph(shade, 1), "█");
    assert.equal(style.rampGlyph(shade, 0), " ");
    assert.deepEqual(style.levelTile(0.5).glyphs, ["▒"]);
    const mixed = style.levelTile(0.375);
    assert.equal(mixed.columns, 4);
    assert.equal(mixed.glyphs.filter((glyph) => glyph === "▒").length, 8);
    assert.equal(style.fillTexture("gradient"), "shade");
    assert.equal(style.fillTexture("hatched"), "hatch");
    assert.equal(style.fillTexture("braille"), "braille");
  });

  test("fill: an edge ramp is densest at its edge", () => {
    const tile = style.edgeTile({ edge: "bottom", from: 1, length: 8, to: 0 });
    assert.equal(tile.columns, 4);
    assert.equal(tile.rows, 8);
    // The bottom row sits half a step into the fade: full and three-quarter shades.
    assert.ok(
      tile.glyphs.slice(-4).every((glyph) => glyph === "█" || glyph === "▓")
    );
    assert.ok(tile.glyphs.slice(-4).includes("█"));
    assert.ok(
      tile.glyphs.slice(0, 4).every((glyph) => glyph === " " || glyph === "·")
    );
  });

  test("fill: styles carry a glyph mask", () => {
    const solid = style.fillStyle("solid", { color: "#fff" });
    assert.deepEqual(solid, { backgroundColor: "#fff" });
    const hatch = style.fillStyle("hatched", { cell: 12 });
    assert.equal(hatch.maskSize, "6px 12px");
    const ramp = style.fillStyle("shade", { cell: 10, length: 8 });
    assert.equal(ramp.maskComposite, "add, subtract, add");
  });

  // ------------------------------------------------------------ export

  const sample = () => {
    const frame = new MutableFrame(3, 2, { color: true });
    frame.write(0, 0, "a<", [255, 0, 0]);
    frame.put(2, 0, "b");
    frame.put(0, 1, "█", [0, 0, 255]);
    frame.put(1, 1, "c");
    return frame;
  };

  test("toText", () => {
    assert.equal(exporter.toText(sample()), "a<b\n█c ");
    assert.equal(exporter.toText(sample(), { trimEnd: true }), "a<b\n█c");
  });

  test("toAnsi: truecolor runs and resets", () => {
    assert.equal(
      exporter.toAnsi(sample(), { ink: "#00ff00" }),
      "\u001B[38;2;255;0;0ma<\u001B[38;2;0;255;0mb\u001B[0m\n\u001B[38;2;0;0;255m█\u001B[38;2;0;255;0mc \u001B[0m\u001B[0m"
    );
  });

  test("toAnsi: ansi16 with a background", () => {
    assert.equal(
      exporter.toAnsi(sample(), {
        background: true,
        mode: "ansi16",
        paper: "#000000",
        trimEnd: true,
      }),
      "\u001B[40m\u001B[91ma<\u001B[39mb\u001B[0m\n\u001B[40m\u001B[94m█\u001B[39mc \u001B[0m\u001B[0m"
    );
  });

  test("toSvg: rows, colour runs and shapes", () => {
    assert.equal(
      exporter.toSvg(sample(), {
        font: "monospace",
        ink: "#111",
        metrics: { height: 12, width: 6 },
        paper: "#fff",
      }),
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="24" viewBox="0 0 18 24"><rect width="100%" height="100%" fill="#fff"/><g fill="#111"><path fill="#0000ff" d="M0 12h6v12h-6Z"/><g font-family="monospace" font-size="10" style="white-space:pre;font-variant-ligatures:none"><text xml:space="preserve" y="6" textLength="18" lengthAdjust="spacing" dominant-baseline="central"><tspan fill="#ff0000">a&lt;</tspan>b</text><text xml:space="preserve" y="18" textLength="12" lengthAdjust="spacing" dominant-baseline="central"><tspan fill="#0000ff"> </tspan>c</text></g></g></svg>'
    );
  });

  let failed = 0;
  for (const [name, run] of cases) {
    try {
      run();
      console.log(`ok   ${name}`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${name}`);
      console.error(error);
    }
  }
  console.log(`\n${cases.length - failed}/${cases.length} passed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
};

await main();
