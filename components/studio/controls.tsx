"use client";

/**
 * The Controls panel: every engine setting, live. Changes go up as
 * patches to the look's overrides.
 */

import { useId, useRef, useState } from "react";

import {
  GlyphSlider,
  PanelButton,
  Section,
  Segmented,
  Toggle,
} from "@/components/studio/fields";
import { colorModesFor } from "@/components/studio/look";
import type { StudioSource } from "@/components/studio/sources";
import {
  CELL_RANGE,
  checkRamp,
  DITHER_OPTIONS,
  FX_KEYS,
} from "@/components/studio/state";
import type {
  FxKey,
  Look,
  LookOverrides,
  StudioCharset,
} from "@/components/studio/state";
import { CHARSET_NAMES, CHARSETS } from "@/lib/ascii/charsets";
import type { CharsetName } from "@/lib/ascii/charsets";
import { CRT_FX, INTERACTIONS, NO_FX } from "@/lib/ascii/look";
import {
  ANSI16,
  PHOSPHOR_NAMES,
  PHOSPHORS,
  RAMP_NAMES,
  RAMPS,
} from "@/lib/ascii/palettes";
import { cn } from "@/lib/utils";

/** A few glyphs that show what a charset looks like, light to dense. */
const charsetSample = (name: CharsetName): string => {
  const { glyphs, kind } = CHARSETS[name];
  if (kind === "braille") {
    return "⡀⣄⣦⣷⣿";
  }
  if (kind === "quadrants") {
    return "▗▚▙▟█";
  }
  if (kind === "edge") {
    return "-/|\\#";
  }
  const inked = glyphs.slice(1);
  return Array.from({ length: 5 }, (_, index) => {
    const at = Math.round((index / 4) * (inked.length - 1));
    return inked[at] ?? "";
  }).join("");
};

/** Keyboard shortcut for each charset: 1 to 9, then 0. */
export const charsetShortcut = (index: number) =>
  index === 9 ? "0" : String(index + 1);

const CharsetPicker = ({
  value,
  onChange,
}: {
  value: StudioCharset;
  onChange: (charset: StudioCharset) => void;
}) => {
  const name = useId();
  const options: readonly StudioCharset[] = [...CHARSET_NAMES, "custom"];
  return (
    <fieldset>
      <legend className="sr-only">Charset</legend>
      <div className="border-rule bg-rule grid grid-cols-2 gap-px overflow-hidden rounded-[3px] border">
        {options.map((option, index) => (
          <label
            key={option}
            className={cn(
              option === "custom" && "col-span-2",
              "bg-background text-foreground/80 hover:text-foreground relative grid cursor-pointer grid-cols-[1fr_auto] items-center gap-x-2 px-2 py-1.5 transition-colors duration-100 select-none",
              "has-[:checked]:bg-foreground has-[:checked]:text-background",
              "has-[:focus-visible]:outline-ring has-[:focus-visible]:z-10 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2"
            )}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            <span className="truncate text-[11px]">
              {option === "custom" ? "Custom ramp" : CHARSETS[option].label}
            </span>
            <span aria-hidden="true" className="text-[10px] tabular opacity-55">
              {option === "custom" ? "" : charsetShortcut(index)}
            </span>
            <span
              aria-hidden="true"
              className="col-span-2 truncate text-[13px] leading-tight tracking-[0.12em] opacity-80"
            >
              {option === "custom" ? "·∘○◎●" : charsetSample(option)}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
};

const RampInput = ({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (chars: string) => void;
}) => {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const check = checkRamp(draft);
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-foreground/80 text-xs">
        Glyphs, empty to dense
      </label>
      <input
        id={id}
        value={draft}
        spellCheck={false}
        autoComplete="off"
        aria-invalid={check.kind === "error"}
        aria-describedby={`${id}-hint`}
        onChange={(event) => {
          const next = event.currentTarget.value;
          setDraft(next);
          if (checkRamp(next).kind === "ok") {
            onCommit(next);
          }
        }}
        className="border-rule bg-background focus-visible:outline-ring aria-invalid:border-destructive h-8 rounded-[3px] border px-2 font-mono text-[13px] tracking-[0.1em] whitespace-pre outline-none focus-visible:outline-2 focus-visible:outline-offset-1"
      />
      <p
        id={`${id}-hint`}
        className={cn(
          "text-[11px]",
          check.kind === "error" ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {check.kind === "error"
          ? check.message
          : `${check.glyphs} glyphs. Start with a space for empty cells.`}
      </p>
    </div>
  );
};

const INK_LABELS = {
  blueprint: "Blueprint",
  ibm: "IBM white",
  p1: "P1 green",
  p3: "P3 amber",
} as const;

const MonoInkPicker = ({
  value,
  onChange,
}: {
  value: Look["ink"];
  onChange: (ink: Look["ink"]) => void;
}) => {
  const name = useId();
  const custom = value.startsWith("#") ? value : "#33ff66";
  const swatch =
    "border-rule bg-background relative flex h-8 cursor-pointer items-center gap-1.5 rounded-[3px] border px-2 text-[11px] select-none has-[:checked]:border-foreground has-[:checked]:shadow-[inset_0_0_0_1px_var(--foreground)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-offset-1";
  return (
    <fieldset className="grid gap-1">
      <legend className="text-foreground/80 mb-1 text-xs">Phosphor</legend>
      <div className="grid grid-cols-2 gap-1.5">
        <label className={swatch}>
          <input
            type="radio"
            name={name}
            checked={value === "theme"}
            onChange={() => onChange("theme")}
            className="sr-only"
          />
          <span aria-hidden="true" className="bg-ink size-2.5 shrink-0" />
          Site palette
        </label>
        {PHOSPHOR_NAMES.map((phosphor) => (
          <label key={phosphor} className={swatch}>
            <input
              type="radio"
              name={name}
              checked={value === phosphor}
              onChange={() => onChange(phosphor)}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0"
              style={{
                backgroundColor: PHOSPHORS[phosphor].ink,
                boxShadow: `0 0 0 2px ${PHOSPHORS[phosphor].paper}`,
              }}
            />
            {INK_LABELS[phosphor]}
          </label>
        ))}
        <label className={swatch}>
          <input
            type="radio"
            name={name}
            checked={value.startsWith("#")}
            onChange={() => onChange(custom)}
            className="sr-only"
          />
          <input
            type="color"
            value={custom}
            aria-label="Custom ink colour"
            onChange={(event) => {
              const next = event.currentTarget.value;
              if (/^#[\da-f]{6}$/iu.test(next)) {
                onChange(`#${next.slice(1).toLowerCase()}`);
              }
            }}
            className="size-4 shrink-0 cursor-pointer rounded-none border-0 bg-transparent p-0 [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
          />
          <span className="tabular truncate">{custom}</span>
        </label>
      </div>
    </fieldset>
  );
};

const rampGradient = (stops: readonly string[]) =>
  `linear-gradient(90deg, ${stops
    .map((stop, index) => `${stop} ${(index / (stops.length - 1)) * 100}%`)
    .join(", ")})`;

const RampPicker = ({
  value,
  onChange,
}: {
  value: Look["ramp"];
  onChange: (ramp: Look["ramp"]) => void;
}) => {
  const name = useId();
  return (
    <fieldset className="grid gap-1">
      <legend className="text-foreground/80 mb-1 text-xs">Ramp</legend>
      <div className="grid grid-cols-2 gap-1.5">
        {RAMP_NAMES.map((ramp) => (
          <label
            key={ramp}
            className="border-rule has-[:checked]:border-foreground has-[:focus-visible]:outline-ring grid cursor-pointer gap-1 rounded-[3px] border p-1.5 text-[11px] select-none has-[:checked]:shadow-[inset_0_0_0_1px_var(--foreground)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1"
          >
            <input
              type="radio"
              name={name}
              checked={value === ramp}
              onChange={() => onChange(ramp)}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              className="h-2 w-full"
              style={{ backgroundImage: rampGradient(RAMPS[ramp]) }}
            />
            {ramp}
          </label>
        ))}
      </div>
    </fieldset>
  );
};

const FX_LABELS: Readonly<Record<FxKey, string>> = {
  bloom: "Bloom",
  curvature: "Curvature",
  flicker: "Flicker",
  glitch: "Glitch",
  scanlines: "Scanlines",
  vignette: "Vignette",
};

/** The amount an effect gets when switched on without one. */
const FX_ON: Readonly<Record<FxKey, number>> = {
  ...CRT_FX,
  glitch: 0.35,
};

const isCrt = (fx: Look["fx"]) =>
  FX_KEYS.every((key) => fx[key] === CRT_FX[key]);

const COLOR_MODE_LABELS: Readonly<Record<Look["colorMode"], string>> = {
  ansi16: "ANSI 16",
  duotone: "Duotone",
  mono: "Mono",
  native: "Native",
  truecolor: "True",
};

export interface ControlsProps {
  source: StudioSource;
  look: Look;
  defaults: Look;
  paused: boolean;
  onChange: (patch: LookOverrides) => void;
  onPause: (paused: boolean) => void;
  onReset: () => void;
  /** Overrides are set, so reset has something to do. */
  dirty: boolean;
}

export const Controls = ({
  source,
  look,
  defaults,
  paused,
  onChange,
  onPause,
  onReset,
  dirty,
}: ControlsProps) => {
  // Where the edge toggle returns to when switched off.
  const beforeEdge = useRef<StudioCharset>(
    defaults.charset === "edge" ? "standard" : defaults.charset
  );
  const colorModes = colorModesFor(source);
  const setFx = (key: FxKey, value: number) =>
    onChange({ fx: { ...look.fx, [key]: value } });

  return (
    <div className="divide-rule flex flex-col divide-y">
      <Section
        title="Glyphs"
        action={
          <PanelButton
            onClick={onReset}
            disabled={!dirty}
            className="h-5 px-1.5 text-[10px]"
          >
            Reset all
          </PanelButton>
        }
      >
        <CharsetPicker
          value={look.charset}
          onChange={(charset) => {
            if (charset !== "edge") {
              beforeEdge.current = charset;
            }
            onChange(
              charset === "custom" && look.chars === ""
                ? { chars: " .·:;+*%#@", charset }
                : { charset }
            );
          }}
        />
        {look.charset === "custom" ? (
          <RampInput
            key={look.chars === "" ? "empty" : "set"}
            value={look.chars}
            onCommit={(chars) => onChange({ chars })}
          />
        ) : null}
        <GlyphSlider
          label="Cell size"
          value={look.cell}
          min={CELL_RANGE.min}
          max={CELL_RANGE.max}
          step={1}
          unit="px"
          onChange={(cell) => onChange({ cell })}
        />
      </Section>

      <Section title="Tone">
        <GlyphSlider
          label="Brightness"
          value={look.brightness}
          min={-1}
          max={1}
          step={0.01}
          onChange={(brightness) => onChange({ brightness })}
          format={(value) => `${value > 0 ? "+" : ""}${value.toFixed(2)}`}
        />
        <GlyphSlider
          label="Contrast"
          value={look.contrast}
          min={0}
          max={3}
          step={0.05}
          onChange={(contrast) => onChange({ contrast })}
          format={(value) => `${value.toFixed(2)}×`}
        />
        <GlyphSlider
          label="Gamma"
          value={look.gamma}
          min={0.2}
          max={3}
          step={0.05}
          onChange={(gamma) => onChange({ gamma })}
          format={(value) => value.toFixed(2)}
        />
        <GlyphSlider
          label="Saturation"
          value={look.saturation}
          min={0}
          max={2}
          step={0.05}
          onChange={(saturation) => onChange({ saturation })}
          format={(value) => `${Math.round(value * 100)}%`}
          disabled={look.colorMode !== "truecolor"}
        />
        <Segmented
          label="Ordered dithering"
          value={look.dither}
          options={DITHER_OPTIONS.map((value) => ({
            label:
              value === "blue-noise" ? "blue" : value.replace("bayer", "b"),
            title: value === "none" ? "No dithering" : value,
            value,
          }))}
          onChange={(dither) => onChange({ dither })}
        />
        <Toggle
          label="Invert tones"
          checked={look.invert}
          onChange={(invert) => onChange({ invert })}
        />
      </Section>

      <Section title="Edges">
        <Toggle
          label="Directional edge glyphs"
          hint="- / | \\"
          checked={look.charset === "edge"}
          onChange={(on) => {
            if (on && look.charset !== "edge") {
              beforeEdge.current = look.charset;
            }
            onChange({ charset: on ? "edge" : beforeEdge.current });
          }}
        />
        <GlyphSlider
          label="Sobel threshold"
          value={look.edgeThreshold}
          min={0}
          max={1}
          step={0.01}
          onChange={(edgeThreshold) => onChange({ edgeThreshold })}
          format={(value) => value.toFixed(2)}
          disabled={look.charset !== "edge"}
        />
      </Section>

      <Section title="Colour">
        <Segmented
          label="Colour mode"
          hideLabel
          value={look.colorMode}
          options={colorModes.map((value) => ({
            label: COLOR_MODE_LABELS[value],
            value,
          }))}
          onChange={(colorMode) => onChange({ colorMode })}
          columns={colorModes.length > 4 ? 3 : 2}
        />
        {look.colorMode === "native" ? (
          <p className="text-muted-foreground text-[11px] text-pretty">
            The source&apos;s own palette, which follows the site palette.
          </p>
        ) : null}
        {look.colorMode === "mono" ? (
          <MonoInkPicker
            value={look.ink}
            onChange={(ink) => onChange({ ink })}
          />
        ) : null}
        {look.colorMode === "ansi16" ? (
          <div className="grid gap-2">
            <Segmented
              label="ANSI table"
              value={look.ansi}
              options={[
                { label: "VGA", value: "vga" },
                { label: "xterm", value: "xterm" },
              ]}
              onChange={(ansi) => onChange({ ansi })}
            />
            <div aria-hidden="true" className="grid grid-cols-16 gap-px">
              {ANSI16[look.ansi].map(([r, g, b], index) => (
                <span
                  // oxlint-disable-next-line react/no-array-index-key -- a fixed 16-entry table.
                  key={index}
                  className="aspect-square"
                  style={{ backgroundColor: `rgb(${r} ${g} ${b})` }}
                />
              ))}
            </div>
          </div>
        ) : null}
        {look.colorMode === "duotone" ? (
          <RampPicker
            value={look.ramp}
            onChange={(ramp) => onChange({ ramp })}
          />
        ) : null}
        <Toggle
          label="Transparent background"
          checked={look.background === "transparent"}
          onChange={(on) =>
            onChange({ background: on ? "transparent" : "paper" })
          }
        />
      </Section>

      <Section
        title="CRT"
        action={
          <PanelButton
            active={isCrt(look.fx)}
            onClick={() => onChange({ fx: isCrt(look.fx) ? NO_FX : CRT_FX })}
            className="h-5 px-1.5 text-[10px]"
          >
            CRT preset
          </PanelButton>
        }
      >
        {FX_KEYS.map((key) => (
          <div
            key={key}
            className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-2"
          >
            <Toggle
              label={FX_LABELS[key]}
              checked={look.fx[key] > 0}
              onChange={(on) => setFx(key, on ? FX_ON[key] : 0)}
            />
            <GlyphSlider
              label={`${FX_LABELS[key]} amount`}
              value={look.fx[key]}
              min={0}
              max={1}
              step={0.01}
              onChange={(value) => setFx(key, value)}
              format={(value) => `${Math.round(value * 100)}%`}
              compact
            />
          </div>
        ))}
      </Section>

      <Section title="Motion">
        <Segmented
          label="Pointer"
          value={look.interaction}
          options={INTERACTIONS.map((value) => ({ label: value, value }))}
          onChange={(interaction) => onChange({ interaction })}
        />
        <GlyphSlider
          label="Speed"
          value={look.speed}
          min={0}
          max={4}
          step={0.05}
          onChange={(speed) => onChange({ speed })}
          format={(value) => `${value.toFixed(2)}×`}
        />
        <Toggle
          label="Pause"
          hint="space"
          checked={paused}
          onChange={onPause}
        />
      </Section>
    </div>
  );
};
