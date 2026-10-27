"use client";

import { Slider as SliderPrimitive } from "radix-ui";
import { createContext, useContext, useId } from "react";
import type { KeyboardEvent, ReactNode } from "react";

import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { cssColor } from "@/lib/ascii";
import { readControl } from "@/lib/preview-controls";
import type {
  ColorControl,
  OptionsControl,
  PreviewControl,
  PreviewValue,
  SegmentedControl,
  SliderControl,
  ToggleControl,
} from "@/lib/preview-controls";
import { cn } from "@/lib/utils";

/*
 * Direction: a quiet inspector tray, after Figma's properties panel and
 * Linear's settings rows. Mono uppercase labels, one control per row,
 * the selected state in the ink colour, nothing louder than the demo.
 */

type Values = Readonly<Record<string, PreviewValue>>;

const ValuesContext = createContext<Values | null>(null);

/** Supplies knob values to the demo below it. The preview frame renders it. */
export const PreviewControlsProvider = ({
  values,
  children,
}: {
  values: Values;
  children: ReactNode;
}) => <ValuesContext value={values}>{children}</ValuesContext>;

/**
 * The live value of a knob, typed by its control. Outside a preview frame
 * (the demo rendered anywhere else) it is the control's default.
 *
 * ```tsx
 * const fill = usePreviewValue(areaChartControls.fill); // "gradient" | "dotted" | ...
 * ```
 */
export function usePreviewValue<O extends string>(
  control: OptionsControl<O>
): O;
export function usePreviewValue(control: SliderControl): number;
export function usePreviewValue(control: ToggleControl): boolean;
export function usePreviewValue(control: PreviewControl): PreviewValue {
  const values = useContext(ValuesContext);
  return readControl(control, values?.[control.id]);
}

const LABEL = "label-caps text-muted-foreground";

/** Arrow keys move the selection in a radio group, wrapping at the ends. */
const onRadioKeys = (
  event: KeyboardEvent<HTMLElement>,
  options: readonly string[],
  current: string,
  choose: (value: string) => void
) => {
  const step = {
    ArrowDown: 1,
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -1,
  }[event.key];
  if (step === undefined) {
    return;
  }
  event.preventDefault();
  const index = options.indexOf(current);
  const next = options.at((index + step) % options.length) ?? current;
  choose(next);
  const group = event.currentTarget.closest("[role=radiogroup]");
  group
    ?.querySelector<HTMLElement>(`[data-value="${CSS.escape(next)}"]`)
    ?.focus();
};

const Segmented = ({
  control,
  value,
  onChange,
  labelId,
}: {
  control: SegmentedControl;
  value: string;
  onChange: (value: string) => void;
  labelId: string;
}) => (
  <div
    role="radiogroup"
    aria-labelledby={labelId}
    className="divide-border relative flex divide-x rounded-xs border"
  >
    {control.options.map((option) => {
      const checked = option === value;
      return (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={checked}
          data-value={option}
          tabIndex={checked ? 0 : -1}
          onClick={() => onChange(option)}
          onKeyDown={(event) =>
            onRadioKeys(event, control.options, value, onChange)
          }
          className={cn(
            "relative h-7 min-w-0 flex-1 truncate px-2 font-mono text-[11px] transition-colors duration-150 ease-out focus-visible:z-10",
            checked
              ? "bg-ink-soft text-ink"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          )}
        >
          {option}
        </button>
      );
    })}
  </div>
);

const Swatches = ({
  control,
  value,
  onChange,
  labelId,
}: {
  control: ColorControl;
  value: string;
  onChange: (value: string) => void;
  labelId: string;
}) => (
  <div
    role="radiogroup"
    aria-labelledby={labelId}
    className="-mx-1 flex flex-wrap gap-0.5"
  >
    {control.options.map((option) => {
      const checked = option === value;
      return (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={checked}
          aria-label={option}
          title={option}
          data-value={option}
          tabIndex={checked ? 0 : -1}
          onClick={() => onChange(option)}
          onKeyDown={(event) =>
            onRadioKeys(event, control.options, value, onChange)
          }
          className="group/swatch relative size-7 rounded-xs"
        >
          {/* Ring and dot share one box, so they stay concentric. The ring
              takes the swatch's own colour. */}
          <span
            aria-hidden
            className={cn(
              "absolute inset-px rounded-xs border transition-colors duration-150 ease-out",
              checked
                ? "border-current"
                : "group-hover/swatch:border-current/35 border-transparent"
            )}
            style={{ color: cssColor(option) }}
          />
          <span
            aria-hidden
            className="absolute inset-[5px] rounded-[1px] transition-[scale] duration-150 ease-out group-active/swatch:scale-[0.96] motion-reduce:transition-none"
            style={{ background: cssColor(option) }}
          />
        </button>
      );
    })}
  </div>
);

/**
 * A slider whose fill and thumb glide between values instead of jumping,
 * so stepped knobs (curtains 3 to 4) move as smoothly as fine ones.
 */
const Knob = ({
  control,
  value,
  onChange,
  labelId,
}: {
  control: SliderControl;
  value: number;
  onChange: (value: number) => void;
  labelId: string;
}) => {
  const collapsed = control.max <= control.min;
  return (
    <SliderPrimitive.Root
      min={control.min}
      // A collapsed range (min === max) would position the thumb at NaN.
      max={collapsed ? control.min + 1 : control.max}
      disabled={collapsed}
      step={control.step}
      value={[value]}
      onValueChange={([next]) => {
        if (next !== undefined) {
          onChange(next);
        }
      }}
      // Radix focuses the thumb from script on drag, which Chrome treats as
      // keyboard focus. Hide the ring after a pointer and restore it on a key.
      onPointerDown={(event) => {
        event.currentTarget.dataset.pointer = "";
      }}
      onKeyDown={(event) => {
        delete event.currentTarget.dataset.pointer;
      }}
      onBlur={(event) => {
        delete event.currentTarget.dataset.pointer;
      }}
      className="group/knob knob-glide relative flex h-4 w-full cursor-pointer touch-none items-center select-none data-disabled:cursor-default data-disabled:opacity-50"
    >
      {/* A ruled track with tick marks every tenth, filled in ink up to the
          value; the thumb is a cursor bar. */}
      <SliderPrimitive.Track className="border-rule relative h-2 grow overflow-hidden rounded-[1px] border bg-[repeating-linear-gradient(to_right,transparent_0_calc(10%-1px),var(--border)_calc(10%-1px)_10%)]">
        <SliderPrimitive.Range className="bg-ascii-ink absolute h-full transition-[left,right] duration-150 ease-(--ease-out) motion-reduce:transition-none" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-labelledby={labelId}
        className="bg-foreground focus-visible:outline-ring block h-4 w-1.5 rounded-[1px] shadow-[0_0_0_2px_var(--card)] transition-[scale] duration-150 ease-out outline-offset-2 focus-visible:outline group-hover/knob:scale-y-110 active:scale-y-110 motion-reduce:transition-none group-data-pointer/knob:outline-none!"
      />
    </SliderPrimitive.Root>
  );
};

const Switch = ({
  checked,
  onChange,
  labelId,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  labelId: string;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-labelledby={labelId}
    onClick={() => onChange(!checked)}
    className={cn(
      "flex h-6 shrink-0 items-stretch overflow-hidden rounded-xs border font-mono text-[11px] transition-colors duration-150 ease-out",
      checked ? "border-(--ascii-ink)" : "border-rule"
    )}
  >
    <span
      aria-hidden
      className={cn(
        "flex w-8 items-center justify-center",
        checked ? "bg-ascii-ink text-primary-foreground" : "text-faint"
      )}
    >
      on
    </span>
    <span
      aria-hidden
      className={cn(
        "flex w-8 items-center justify-center",
        checked ? "text-faint" : "bg-muted text-foreground"
      )}
    >
      off
    </span>
  </button>
);

const ControlRow = ({
  control,
  raw,
  onChange,
}: {
  control: PreviewControl;
  raw: PreviewValue | undefined;
  onChange: (id: string, value: PreviewValue) => void;
}) => {
  const labelId = useId();
  const set = (value: PreviewValue) => onChange(control.id, value);
  const value = readControl(control, raw);

  const label = (
    <span id={labelId} className={LABEL}>
      {control.label}
    </span>
  );

  switch (control.kind) {
    case "toggle": {
      return (
        <div className="flex items-center justify-between gap-3">
          {label}
          <Switch
            checked={readControl(control, raw)}
            onChange={set}
            labelId={labelId}
          />
        </div>
      );
    }
    case "slider": {
      const number = readControl(control, raw);
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            {label}
            <span className="text-foreground font-mono text-[11px] tabular-nums">
              {number}
              {control.unit ?? ""}
            </span>
          </div>
          <Knob
            control={control}
            value={number}
            onChange={set}
            labelId={labelId}
          />
        </div>
      );
    }
    case "segmented": {
      return (
        <div className="flex flex-col gap-2">
          {label}
          <Segmented
            control={control}
            value={String(value)}
            onChange={set}
            labelId={labelId}
          />
        </div>
      );
    }
    case "color": {
      return (
        <div className="flex flex-col gap-2">
          {label}
          <Swatches
            control={control}
            value={String(value)}
            onChange={set}
            labelId={labelId}
          />
        </div>
      );
    }
    case "select": {
      return (
        <div className="flex flex-col gap-2">
          {label}
          <NativeSelect
            size="sm"
            aria-labelledby={labelId}
            value={String(value)}
            onChange={(event) => set(event.currentTarget.value)}
            className="font-mono text-[11px]"
          >
            {control.options.map((option) => (
              <NativeSelectOption key={option} value={option}>
                {option}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      );
    }
    default: {
      const exhaustive: never = control;
      return exhaustive;
    }
  }
};

/** `tray` sits under the stage; `sidebar` is one column beside it. */
export type PreviewControlsLayout = "tray" | "sidebar";

const LAYOUT_CLASS = {
  sidebar: {
    grid: "grid-cols-1 lg:grid-cols-1",
    root: "border-t lg:border-t-0",
  },
  tray: { grid: "grid-cols-1 sm:grid-cols-2", root: "border-t" },
} as const satisfies Record<
  PreviewControlsLayout,
  { grid: string; root: string }
>;

/**
 * The controls tray under the stage, one or two columns wide, or a single
 * column beside a full-screen stage. Each change re-renders the demo with
 * the new value; Replay keeps the values.
 */
export const PreviewControlsPanel = ({
  controls,
  values,
  onChange,
  onReset,
  layout = "tray",
}: {
  controls: readonly PreviewControl[];
  values: Values;
  onChange: (id: string, value: PreviewValue) => void;
  onReset: () => void;
  layout?: PreviewControlsLayout;
}) => {
  const changed = controls.some(
    (control) => readControl(control, values[control.id]) !== control.default
  );
  return (
    <div
      role="group"
      aria-label="Preview controls"
      className={cn(
        "flex flex-col gap-4 px-4 pt-3 pb-4",
        LAYOUT_CLASS[layout].root
      )}
    >
      <div className="flex h-5 items-center justify-between">
        <span className="label-caps text-foreground">Controls</span>
        <button
          type="button"
          onClick={onReset}
          disabled={!changed}
          className="text-muted-foreground hover:text-foreground rounded-xs font-mono text-[11px] lowercase transition-[color,opacity] duration-150 disabled:pointer-events-none disabled:opacity-0"
        >
          Reset
        </button>
      </div>
      <div className={cn("grid gap-x-6 gap-y-4", LAYOUT_CLASS[layout].grid)}>
        {controls.map((control) => (
          <ControlRow
            key={control.id}
            control={control}
            raw={values[control.id]}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  );
};
