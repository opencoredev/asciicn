"use client";

/*
 * Direction (home hero)
 * Reference: an oscilloscope front panel (every reading labelled and live)
 *   and a design tool's canvas with its inspector, not a marketing banner.
 * Palette: site tokens only. Paper behind glyphs, the palette ink for
 *   anything live, 1px rules for structure. No second accent.
 * Type: Martian Mono for the headline and labels, Cascadia Mono for
 *   readouts and glyphs.
 * Layout: the stage is the page. Rulers on two edges, telemetry under it,
 *   switches docked on it, the headline in an opaque pane docked bottom-left
 *   so it reads in every palette.
 * Signature: the glyph inspector. Point at any cell and read the glyph,
 *   its code point and the density it stands for.
 * Avoiding: centred headline on a dark plate, text floating over an image,
 *   a sidebar list of pieces, a before/after slider, feature-card rows.
 */

import { createContext, use, useRef, useState } from "react";
import type { ReactNode } from "react";

import { ExportStrip, installCommand } from "@/components/home/export-strip";
import { lookProps } from "@/components/home/looks";
import type { StageSettings } from "@/components/home/looks";
import { findSource, STAGE_SOURCES } from "@/components/home/sources";
import type { StageSource } from "@/components/home/sources";
import { Stage } from "@/components/home/stage";
import {
  CompactStageControls,
  StageControls,
} from "@/components/home/stage-controls";
import type { SettingsPatch } from "@/components/home/stage-controls";
import { Prompt } from "@/components/terminal/prompt";
import { useSiteOrigin } from "@/hooks/use-site-origin";
import type { AsciiHandle } from "@/lib/ascii";

const FIRST_SOURCE = "synthwave-horizon-scene";

const HeroSource = createContext<StageSource | null>(null);

/**
 * Settings for one stage, with the source looked up. Unknown ids fall back
 * to the first source, so a stale link still draws something.
 */
export const useStageSettings = (
  initial: StageSettings,
  sources: readonly StageSource[] = STAGE_SOURCES
) => {
  const [settings, setSettings] = useState(initial);
  const source =
    findSource(settings.sourceId, sources) ?? sources[0] ?? STAGE_SOURCES[0];
  const update = (patch: SettingsPatch) =>
    setSettings((current) => ({ ...current, ...patch }));
  return { settings, source, update } as const;
};

export const StudioHero = ({ headline }: { headline: ReactNode }) => {
  const { settings, source, update } = useStageSettings({
    cell: 12,
    charset: null,
    colorId: null,
    fx: new Set(),
    sourceId: FIRST_SOURCE,
  });
  const handle = useRef<AsciiHandle | null>(null);
  const charset = settings.charset ?? source.charset;

  return (
    <HeroSource value={source}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:gap-3">
        <div className="min-w-0 lg:pointer-events-none lg:z-30 lg:col-start-1 lg:row-start-1 lg:mb-[52px] lg:ml-8 lg:self-end lg:justify-self-start">
          {headline}
        </div>
        <Stage
          className="lg:col-start-1 lg:row-start-1"
          areaClassName="h-[min(68svh,560px)] lg:h-[max(600px,calc(100svh-var(--header-height)-7.5rem))]"
          source={source}
          look={lookProps(settings)}
          charset={charset}
          cell={settings.cell}
          handle={handle}
        >
          <div className="bg-background/92 border-rule absolute top-3 left-3 z-20 hidden max-w-[calc(100%-17rem)] border px-3 py-2.5 backdrop-blur-sm lg:block">
            <StageControls
              settings={settings}
              source={source}
              sources={STAGE_SOURCES}
              onChange={update}
            />
          </div>
        </Stage>
        <CompactStageControls
          className="lg:hidden"
          settings={settings}
          source={source}
          sources={STAGE_SOURCES}
          onChange={update}
        />
        <ExportStrip
          source={source}
          settings={settings}
          handle={handle}
          install={false}
        />
      </div>
    </HeroSource>
  );
};

/** The install command for whatever the hero is showing. */
export const HeroInstall = () => {
  const source = use(HeroSource);
  const origin = useSiteOrigin();
  return (
    <Prompt
      size="sm"
      className="pointer-events-auto"
      command={installCommand(origin, source?.id ?? FIRST_SOURCE)}
      event="install_command_copied"
      eventProperties={{ section: "hero" }}
    />
  );
};
