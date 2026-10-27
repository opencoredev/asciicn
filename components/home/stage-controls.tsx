"use client";

import { SlidersHorizontalIcon } from "@hugeicons/core-free-icons";
import { useId } from "react";
import type { ReactNode } from "react";

import {
  CELL_SIZES,
  CHARSET_OPTIONS,
  CHARSET_SIGNS,
  COLOR_OPTIONS,
  FX_SWITCHES,
  isCellSize,
} from "@/components/home/looks";
import type { FxSwitch, StageSettings } from "@/components/home/looks";
import type { StageSource } from "@/components/home/sources";
import { Icon } from "@/components/icon";
import { Segmented } from "@/components/terminal/segmented";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { CHARSETS } from "@/lib/ascii";
import type { CharsetName } from "@/lib/ascii";
import { cn } from "@/lib/utils";

/**
 * The switches for a stage: source, charset, colour, cell size and (on
 * /backgrounds) the CRT effects. `StageControls` lays them out as one strip on
 * wide screens; under `lg` it shrinks to the source picker and a button
 * that opens the rest in a bottom sheet.
 */

export type SettingsPatch = Partial<
  Pick<StageSettings, "sourceId" | "charset" | "colorId" | "cell" | "fx">
>;

interface ControlProps {
  settings: StageSettings;
  source: StageSource;
  onChange: (patch: SettingsPatch) => void;
}

const GROUP_LABEL = "label-caps text-muted-foreground shrink-0";

// A radio styled as a square key. Native radios give arrow-key movement
// within the group for free.
const KEY =
  "border-rule text-muted-foreground hover:text-foreground hover:border-foreground/40 has-[:checked]:border-ink has-[:checked]:bg-ink-soft has-[:checked]:text-ink has-[:focus-visible]:outline-ring relative grid size-7 shrink-0 cursor-pointer place-items-center border font-mono text-sm leading-none transition-colors duration-150 select-none has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1";

export const SourceSelect = ({
  settings,
  sources,
  onChange,
  className,
}: {
  settings: StageSettings;
  sources: readonly StageSource[];
  onChange: (patch: SettingsPatch) => void;
  className?: string;
}) => {
  const id = useId();
  const cities = sources.filter((source) => source.kind === "city");
  const shaders = sources.filter((source) => source.kind === "shader");
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <label htmlFor={id} className={GROUP_LABEL}>
        Source
      </label>
      <div className="relative min-w-0 flex-1">
        <select
          id={id}
          value={settings.sourceId}
          onChange={(event) => onChange({ sourceId: event.target.value })}
          className="border-rule bg-background text-foreground hover:border-foreground/40 focus-visible:outline-ring h-7 w-full min-w-0 cursor-pointer appearance-none truncate border py-0 pr-7 pl-2 font-mono text-xs focus-visible:outline-2 focus-visible:outline-offset-1"
        >
          <optgroup label="Cities">
            {cities.map((source) => (
              <option key={source.id} value={source.id}>
                {source.id}
              </option>
            ))}
          </optgroup>
          {shaders.length > 0 ? (
            <optgroup label="Shaders">
              {shaders.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.id}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
        <span
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 font-mono text-[10px]"
        >
          ▼
        </span>
      </div>
    </div>
  );
};

export const CharsetPicker = ({
  settings,
  source,
  onChange,
  className,
}: ControlProps & { className?: string }) => {
  const name = useId();
  const labelId = useId();
  const active: CharsetName = settings.charset ?? source.charset;
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      className={cn("flex min-w-0 items-center gap-2", className)}
    >
      <span id={labelId} className={GROUP_LABEL}>
        Charset
      </span>
      <div className="flex flex-wrap gap-1">
        {CHARSET_OPTIONS.map((option) => (
          <label
            key={option.id}
            className={KEY}
            title={`${option.label}${option.id === source.charset ? " (default)" : ""}`}
          >
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={option.id === active}
              onChange={() =>
                onChange({
                  charset: option.id === source.charset ? null : option.id,
                })
              }
              className="sr-only"
              aria-label={option.label}
            />
            <span aria-hidden>{option.sign}</span>
            {option.id === source.charset ? (
              <span
                aria-hidden
                className="bg-faint absolute -bottom-px left-1/2 h-px w-2 -translate-x-1/2"
              />
            ) : null}
          </label>
        ))}
      </div>
    </div>
  );
};

export const ColorPicker = ({
  settings,
  onChange,
  className,
}: Omit<ControlProps, "source"> & { className?: string }) => {
  const name = useId();
  const labelId = useId();
  const options: readonly {
    id: string | null;
    label: string;
    swatch: ReactNode;
  }[] = [
    {
      id: null,
      label: "Component default",
      swatch: (
        <span
          aria-hidden
          className="text-muted-foreground font-mono text-[10px]"
        >
          A
        </span>
      ),
    },
    ...COLOR_OPTIONS.map((option) => ({
      id: option.id,
      label: option.label,
      swatch: (
        <span
          aria-hidden
          className="block size-3.5 shadow-[inset_0_0_0_1px_oklch(0_0_0/0.2)]"
          style={{ background: option.swatch }}
        />
      ),
    })),
  ];
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      className={cn("flex min-w-0 items-center gap-2", className)}
    >
      <span id={labelId} className={GROUP_LABEL}>
        Colour
      </span>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <label
            key={option.id ?? "default"}
            className={KEY}
            title={option.label}
          >
            <input
              type="radio"
              name={name}
              value={option.id ?? ""}
              checked={option.id === settings.colorId}
              onChange={() => onChange({ colorId: option.id })}
              className="sr-only"
              aria-label={option.label}
            />
            {option.swatch}
          </label>
        ))}
      </div>
    </div>
  );
};

export const CellPicker = ({
  settings,
  onChange,
  className,
}: Omit<ControlProps, "source"> & { className?: string }) => (
  <Segmented
    label="Cell"
    showLabel
    className={className}
    options={CELL_SIZES.map((size) => ({
      label: `${size}`,
      value: `${size}` as const,
    }))}
    value={`${settings.cell}`}
    onValueChange={(value) => {
      const size = Number(value);
      if (isCellSize(size)) {
        onChange({ cell: size });
      }
    }}
  />
);

export const FxPicker = ({
  settings,
  onChange,
  className,
}: Omit<ControlProps, "source"> & { className?: string }) => {
  const labelId = useId();
  const toggle = (name: FxSwitch) => {
    const next = new Set(settings.fx);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    onChange({ fx: next });
  };
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className={cn("flex min-w-0 items-center gap-2", className)}
    >
      <span id={labelId} className={GROUP_LABEL}>
        CRT
      </span>
      <div className="flex flex-wrap gap-1">
        {FX_SWITCHES.map((name) => (
          <label key={name} className={cn(KEY, "w-auto px-2 text-[11px]")}>
            <input
              type="checkbox"
              checked={settings.fx.has(name)}
              onChange={() => toggle(name)}
              className="sr-only"
            />
            {name}
          </label>
        ))}
      </div>
    </div>
  );
};

export interface StageControlsProps extends ControlProps {
  sources: readonly StageSource[];
  /** Show the CRT effect switches. Default false. */
  fx?: boolean;
  /** Show the source picker. Default true. */
  sourcePicker?: boolean;
  className?: string;
}

/** Every switch in one strip, wrapping as needed. */
export const StageControls = ({
  sources,
  fx = false,
  sourcePicker = true,
  className,
  ...props
}: StageControlsProps) => (
  <div
    className={cn(
      "flex flex-wrap items-center gap-x-5 gap-y-2.5 font-mono",
      className
    )}
  >
    {sourcePicker ? (
      <SourceSelect
        settings={props.settings}
        sources={sources}
        onChange={props.onChange}
        className="w-64"
      />
    ) : null}
    <CharsetPicker {...props} />
    <ColorPicker settings={props.settings} onChange={props.onChange} />
    <CellPicker settings={props.settings} onChange={props.onChange} />
    {fx ? (
      <FxPicker settings={props.settings} onChange={props.onChange} />
    ) : null}
  </div>
);

/**
 * Phones: the source picker stays in view, the current charset sits on the
 * sheet button, and everything else opens in a bottom sheet.
 */
export const CompactStageControls = ({
  sources,
  fx = false,
  sourcePicker = true,
  className,
  ...props
}: StageControlsProps) => {
  const active = props.settings.charset ?? props.source.charset;
  return (
    <div className={cn("flex items-center gap-2 font-mono", className)}>
      {sourcePicker ? (
        <SourceSelect
          settings={props.settings}
          sources={sources}
          onChange={props.onChange}
          className="min-w-0 flex-1"
        />
      ) : (
        <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
          {CHARSETS[active].label}
        </span>
      )}
      <Drawer>
        <DrawerTrigger className="border-rule text-foreground hover:border-foreground/40 focus-visible:outline-ring flex h-7 shrink-0 items-center gap-2 border px-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-1">
          <span aria-hidden className="text-ink">
            {CHARSET_SIGNS[active]}
          </span>
          <Icon icon={SlidersHorizontalIcon} className="size-3.5" />
          Adjust
        </DrawerTrigger>
        <DrawerContent className="font-mono">
          <DrawerHeader className="text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
            <DrawerTitle className="label-caps">Stage</DrawerTitle>
            <DrawerDescription className="text-xs">
              Changes apply live. Copy the JSX to keep them.
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-8 [&>*]:flex-col [&>*]:items-start">
            <CharsetPicker {...props} />
            <ColorPicker settings={props.settings} onChange={props.onChange} />
            <CellPicker settings={props.settings} onChange={props.onChange} />
            {fx ? (
              <FxPicker settings={props.settings} onChange={props.onChange} />
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};
