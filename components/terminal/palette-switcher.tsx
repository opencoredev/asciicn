"use client";

/**
 * PaletteSwitcher: picks the site palette (phosphor, amber, cyanotype or a
 * custom OKLCH hue). It writes `<html data-palette>` and `--palette-hue`,
 * persists both to localStorage, and every `--ascii-ink` consumer follows.
 * app/layout.tsx applies the stored palette before paint, so there is no
 * flash on load.
 *
 * Props
 * - `variant`: "menu" (a compact trigger that opens a popover, default) or
 *   "inline" (the options laid out in place, for drawers and panels).
 * - `showLabel`: show the palette name on the trigger ("menu" only).
 *   Default true from the `sm` breakpoint.
 * - `align`: popover alignment ("menu" only). Default "end".
 * - `className`: classes for the root.
 *
 * Use `usePalette()` from `@/components/terminal/use-palette` to read the
 * palette elsewhere.
 */

import { useId } from "react";

import { PALETTES } from "@/components/terminal/palette";
import { usePalette } from "@/components/terminal/use-palette";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface PaletteSwitcherProps {
  /** "menu" opens a popover; "inline" renders the options in place. Default "menu". */
  variant?: "menu" | "inline";
  /** Show the palette name beside the swatch on the trigger. Default true. */
  showLabel?: boolean;
  /** Popover alignment against the trigger. Default "end". */
  align?: "start" | "center" | "end";
  className?: string;
}

// One lightness and chroma for every swatch so they compare by hue alone and
// read on both themes.
const swatch = (hue: number): string => `oklch(0.74 0.15 ${hue})`;

const Swatch = ({ hue, className }: { hue: number; className?: string }) => (
  <span
    aria-hidden
    className={cn(
      "inline-block size-2.5 shrink-0 shadow-[inset_0_0_0_1px_oklch(0_0_0/0.15)]",
      className
    )}
    style={{ backgroundColor: swatch(hue) }}
  />
);

const PaletteOptions = ({ className }: { className?: string }) => {
  const { palette, hue, setPalette, setHue } = usePalette();
  const name = useId();
  const hueId = useId();

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <fieldset className="flex flex-col">
        <legend className="label-caps text-muted-foreground mb-2">
          Palette
        </legend>
        {PALETTES.map((option) => {
          const optionHue = option.id === "custom" ? hue : option.hue;
          return (
            <label
              key={option.id}
              className="hover:bg-accent has-[:focus-visible]:outline-ring flex h-8 cursor-pointer items-center gap-2.5 rounded-xs px-2 text-xs has-[:focus-visible]:outline has-[:checked]:bg-accent"
            >
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={palette === option.id}
                onChange={() => setPalette(option.id)}
                className="peer sr-only"
              />
              <Swatch hue={optionHue} />
              <span className="text-foreground">{option.label}</span>
              <span className="text-muted-foreground ml-auto">
                {option.id === "custom" ? `h ${optionHue}°` : option.note}
              </span>
              <span
                aria-hidden
                className="text-ink w-2 opacity-0 peer-checked:opacity-100"
              >
                ●
              </span>
            </label>
          );
        })}
      </fieldset>
      <div className="flex flex-col gap-1.5 px-2">
        <label
          htmlFor={hueId}
          className="text-muted-foreground flex items-center justify-between text-[11px]"
        >
          <span>oklch hue</span>
          <span className="tabular text-foreground">{hue}°</span>
        </label>
        <input
          id={hueId}
          type="range"
          min={0}
          max={359}
          step={1}
          value={hue}
          onChange={(event) => setHue(Number(event.target.value))}
          className="hue-range"
          aria-valuetext={`Hue ${hue} degrees`}
        />
      </div>
    </div>
  );
};

export const PaletteSwitcher = ({
  variant = "menu",
  showLabel = true,
  align = "end",
  className,
}: PaletteSwitcherProps) => {
  const { palette, hue } = usePalette();
  const active = PALETTES.find((option) => option.id === palette);
  const activeHue = palette === "custom" ? hue : (active?.hue ?? hue);

  if (variant === "inline") {
    return <PaletteOptions className={className} />;
  }

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "text-muted-foreground hover:text-foreground hover:bg-accent data-[state=open]:bg-accent data-[state=open]:text-foreground flex h-8 items-center gap-2 rounded-xs px-2 text-xs transition-colors duration-150",
          className
        )}
        aria-label={`Palette: ${active?.label ?? palette}`}
      >
        <Swatch hue={activeHue} />
        {showLabel ? (
          <span className="label-caps hidden sm:inline">
            {active?.label ?? palette}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align={align} sideOffset={8} className="w-64 p-2">
        <PaletteOptions />
      </PopoverContent>
    </Popover>
  );
};
