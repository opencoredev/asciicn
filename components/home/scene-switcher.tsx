"use client";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { useId, useRef } from "react";

import { TEXT_LINK } from "@/components/home/cta";
import { installCommand } from "@/components/home/export-strip";
import { lookProps } from "@/components/home/looks";
import { SceneStill } from "@/components/home/scene-still";
import { StillBaker } from "@/components/home/scene-stills";
import { SCENE_SOURCES } from "@/components/home/sources";
import { Stage } from "@/components/home/stage";
import { CharsetPicker, ColorPicker } from "@/components/home/stage-controls";
import { useStageSettings } from "@/components/home/studio-hero";
import { Icon } from "@/components/icon";
import { Prompt } from "@/components/terminal/prompt";
import { useSiteOrigin } from "@/hooks/use-site-origin";
import { useInView } from "@/lib/ascii";
import type { AsciiHandle } from "@/lib/ascii";
import { cn } from "@/lib/utils";

const FIRST_SCENE = "warp-tunnel-scene";

/**
 * Home: one large live stage for the selected scene, and every scene as a
 * still frame to pick from. Only the stage holds a WebGL context; the
 * stills are text, baked one scene at a time when the section comes near.
 */
export const SceneSwitcher = () => {
  const { settings, source, update } = useStageSettings(
    {
      cell: 12,
      charset: null,
      colorId: null,
      fx: new Set(),
      sourceId: FIRST_SCENE,
    },
    SCENE_SOURCES
  );
  const handle = useRef<AsciiHandle | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const near = useInView(rootRef, { rootMargin: "400px 0px" });
  const origin = useSiteOrigin();
  const name = useId();
  const index = SCENE_SOURCES.indexOf(source);

  return (
    <div ref={rootRef} className="flex flex-col gap-4">
      <Stage
        source={source}
        look={lookProps(settings)}
        charset={settings.charset ?? source.charset}
        cell={settings.cell}
        handle={handle}
        inspector="chip"
        areaClassName="aspect-[4/5] sm:aspect-video lg:aspect-auto lg:h-[540px]"
      >
        <div className="bg-background/92 border-rule absolute bottom-3 left-3 z-20 max-w-[min(26rem,calc(100%-1.5rem))] border p-3 backdrop-blur-sm">
          <p className="label-caps text-muted-foreground tabular">
            {String(index + 1).padStart(2, "0")} / {SCENE_SOURCES.length} ·{" "}
            {source.renderer === "gpu" ? "WebGL2" : "Canvas2D"}
          </p>
          <p className="font-display mt-1 text-[15px] leading-snug">
            {source.title}
          </p>
          <p className="text-muted-foreground mt-1 line-clamp-2 text-[13px] text-pretty">
            {source.description}
          </p>
        </div>
      </Stage>

      <div
        role="radiogroup"
        aria-label="Scene"
        className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6"
      >
        {SCENE_SOURCES.map((scene, position) => (
          <label
            key={scene.id}
            className="group/thumb border-rule hover:border-foreground/40 has-[:checked]:border-ink has-[:focus-visible]:outline-ring relative flex cursor-pointer flex-col border transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
          >
            <input
              type="radio"
              name={name}
              value={scene.id}
              checked={scene.id === source.id}
              onChange={() => update({ sourceId: scene.id })}
              className="sr-only"
            />
            <SceneStill source={scene} />
            <span className="border-rule flex items-center gap-1.5 border-t px-2 py-1.5 font-mono text-[11px]">
              <span className="text-faint tabular group-has-[:checked]/thumb:text-ink">
                {String(position + 1).padStart(2, "0")}
              </span>
              <span className="text-muted-foreground group-has-[:checked]/thumb:text-foreground truncate">
                {scene.id.replace(/-scene$/u, "")}
              </span>
            </span>
          </label>
        ))}
      </div>
      <StillBaker sources={SCENE_SOURCES} active={near} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
          <CharsetPicker
            settings={settings}
            source={source}
            onChange={update}
          />
          <ColorPicker settings={settings} onChange={update} />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:shrink-0">
          <Prompt
            size="sm"
            className="sm:w-auto sm:max-w-md"
            command={installCommand(origin, source.id)}
            event="install_command_copied"
            eventProperties={{ section: "scene_switcher" }}
          />
          <Link
            href={`/studio?source=${source.id}`}
            className={cn(TEXT_LINK, "shrink-0")}
          >
            Open in Studio
            <Icon icon={ArrowRight01Icon} className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
};
