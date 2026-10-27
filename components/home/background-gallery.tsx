"use client";

import {
  ArrowRight01Icon,
  Copy01Icon,
  PlayIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { CityStill } from "@/components/home/city-still";
import { StillBaker } from "@/components/home/city-stills";
import { TEXT_LINK } from "@/components/home/cta";
import { ExportStrip, installCommand } from "@/components/home/export-strip";
import { CHARSET_SIGNS, lookProps } from "@/components/home/looks";
import { CITY_SOURCES, findSource } from "@/components/home/sources";
import type { StageSource } from "@/components/home/sources";
import { Stage } from "@/components/home/stage";
import {
  CompactStageControls,
  StageControls,
} from "@/components/home/stage-controls";
import { useStageSettings } from "@/components/home/use-stage-settings";
import { Icon } from "@/components/icon";
import { Kbd } from "@/components/ui/kbd";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useSiteOrigin } from "@/hooks/use-site-origin";
import { CHARSETS } from "@/lib/ascii";
import type { AsciiHandle } from "@/lib/ascii";
import { trackEvent } from "@/lib/events";
import { cn } from "@/lib/utils";

/**
 * /backgrounds: the selected city on a big stage with every switch
 * (charset, colour, cell, CRT effects), then all cities as cards. `?city=<id>`
 * selects one and stays in the address bar as you switch, so a link
 * reopens the same city. `[` and `]` step through them.
 */

const FIRST_CITY = CITY_SOURCES[0]?.id ?? "";

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));

const CopyInstall = ({ source }: { source: StageSource }) => {
  const origin = useSiteOrigin();
  const { copyToClipboard, isCopied } = useCopyToClipboard({ timeout: 1500 });
  const command = installCommand(origin, source.id);
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyToClipboard(command)) {
          trackEvent({
            name: "install_command_copied",
            properties: { component_name: source.id, section: "city_card" },
          });
        }
      }}
      className="border-rule text-muted-foreground hover:text-foreground hover:border-foreground/40 focus-visible:outline-ring data-[done=true]:text-ink flex h-8 min-w-0 flex-1 items-center gap-2 border px-2 font-mono text-[11px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1"
      data-done={isCopied}
      aria-label={`Copy install command for ${source.id}`}
    >
      <Icon
        icon={isCopied ? Tick02Icon : Copy01Icon}
        className="size-3.5 shrink-0"
      />
      <span className="truncate">
        {isCopied
          ? "copied"
          : `add ${origin.replace(/^https?:\/\//u, "")}/r/${source.id}.json`}
      </span>
    </button>
  );
};

export const BackgroundGallery = () => {
  const { settings, source, update } = useStageSettings(
    {
      cell: 12,
      charset: null,
      colorId: null,
      fx: new Set(),
      sourceId: FIRST_CITY,
    },
    CITY_SOURCES
  );
  const handle = useRef<AsciiHandle | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const charset = settings.charset ?? source.charset;
  const index = CITY_SOURCES.indexOf(source);

  // Read ?city= once on load; the server render shows the first city.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("city");
    if (requested && findSource(requested, CITY_SOURCES)) {
      update({ sourceId: requested });
    }
    // Only on mount: later changes come from the page itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the address bar in step, without adding history entries.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("city") === source.id) {
      return;
    }
    url.searchParams.set("city", source.id);
    window.history.replaceState(window.history.state, "", url);
  }, [source.id]);

  useEffect(() => {
    const step = (event: KeyboardEvent) => {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTyping(event.target) ||
        (event.key !== "[" && event.key !== "]")
      ) {
        return;
      }
      const count = CITY_SOURCES.length;
      const next =
        CITY_SOURCES[(index + (event.key === "]" ? 1 : -1) + count) % count];
      if (next) {
        update({ sourceId: next.id });
      }
    };
    window.addEventListener("keydown", step);
    return () => window.removeEventListener("keydown", step);
  }, [index, update]);

  const show = (id: string) => {
    update({ sourceId: id });
    stageRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  };

  return (
    <div className="flex flex-col gap-12">
      <div ref={stageRef} className="flex scroll-mt-20 flex-col gap-3">
        <Stage
          source={source}
          look={lookProps(settings)}
          charset={charset}
          cell={settings.cell}
          handle={handle}
          areaClassName="h-[min(64svh,520px)] lg:h-[max(560px,calc(100svh-var(--header-height)-12rem))]"
        >
          <div className="bg-background/92 border-rule absolute top-3 left-3 z-20 hidden max-w-[calc(100%-17rem)] border px-3 py-2.5 backdrop-blur-sm lg:block">
            <StageControls
              settings={settings}
              source={source}
              sources={CITY_SOURCES}
              onChange={update}
              fx
            />
          </div>
          <div className="bg-background/92 border-rule absolute bottom-3 left-3 z-20 max-w-[min(28rem,calc(100%-1.5rem))] border p-3 backdrop-blur-sm">
            <p className="label-caps text-muted-foreground tabular">
              {String(index + 1).padStart(2, "0")} / {CITY_SOURCES.length} ·{" "}
              {source.renderer === "gpu" ? "WebGL2" : "Canvas2D"}
            </p>
            <h2 className="font-display mt-1 text-[15px] leading-snug">
              {source.title}
            </h2>
            <p className="text-muted-foreground mt-1 line-clamp-2 text-[13px] text-pretty">
              {source.description}
            </p>
            <Link
              href={source.href}
              transitionTypes={["nav-forward"]}
              className={cn(TEXT_LINK, "mt-2 text-xs")}
            >
              Docs and props
              <Icon icon={ArrowRight01Icon} className="size-3" />
            </Link>
          </div>
        </Stage>
        <CompactStageControls
          className="lg:hidden"
          settings={settings}
          source={source}
          sources={CITY_SOURCES}
          onChange={update}
          fx
        />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <ExportStrip source={source} settings={settings} handle={handle} />
          <p className="text-muted-foreground hidden items-center gap-1.5 font-mono text-[11px] lg:flex">
            <Kbd>[</Kbd>
            <Kbd>]</Kbd>
            step through cities
          </p>
        </div>
      </div>

      <ul className="grid grid-cols-[minmax(0,1fr)] gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {CITY_SOURCES.map((city, position) => {
          const selected = city.id === source.id;
          return (
            <li
              key={city.id}
              className={cn(
                "border-rule flex flex-col border transition-colors duration-150",
                selected && "border-ink"
              )}
            >
              <button
                type="button"
                onClick={() => show(city.id)}
                aria-pressed={selected}
                aria-label={`Show ${city.title} on the stage`}
                className="group/show focus-visible:outline-ring relative block focus-visible:outline-2 focus-visible:-outline-offset-2"
              >
                <CityStill source={city} />
                <span className="bg-background/92 border-rule text-foreground absolute right-2 bottom-2 flex items-center gap-1.5 border px-2 py-1 font-mono text-[11px] opacity-0 transition-opacity duration-150 group-hover/show:opacity-100 group-focus-visible/show:opacity-100">
                  <Icon icon={PlayIcon} className="size-3" />
                  {selected ? "on stage" : "show on stage"}
                </span>
              </button>
              <div className="border-rule flex flex-1 flex-col gap-2 border-t p-3">
                <div className="text-faint flex items-center justify-between gap-2 font-mono text-[11px]">
                  <span className={cn("tabular", selected && "text-ink")}>
                    {String(position + 1).padStart(2, "0")} · {city.id}
                  </span>
                  <span
                    className="flex items-center gap-1"
                    title={`Default charset: ${CHARSETS[city.charset].label}`}
                  >
                    <span aria-hidden className="text-muted-foreground">
                      {CHARSET_SIGNS[city.charset]}
                    </span>
                    {city.charset} ·{" "}
                    {city.renderer === "gpu" ? "webgl2" : "canvas"}
                  </span>
                </div>
                <h3 className="font-display text-[14px] leading-snug">
                  <Link
                    href={city.href}
                    transitionTypes={["nav-forward"]}
                    className="hover:text-ink focus-visible:outline-ring transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {city.title}
                  </Link>
                </h3>
                <p className="text-muted-foreground line-clamp-2 text-[13px] text-pretty">
                  {city.description}
                </p>
                <div className="mt-auto flex items-center gap-1.5 pt-1">
                  <CopyInstall source={city} />
                  <Link
                    href={`/studio?source=${city.id}`}
                    className="border-rule text-muted-foreground hover:text-foreground hover:border-foreground/40 focus-visible:outline-ring flex h-8 shrink-0 items-center border px-2 font-mono text-[11px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1"
                  >
                    Studio
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <StillBaker sources={CITY_SOURCES} active />
    </div>
  );
};
