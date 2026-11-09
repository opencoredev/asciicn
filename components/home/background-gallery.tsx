"use client";

import {
  ArrowRight01Icon,
  Copy01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { CityStill } from "@/components/home/city-still";
import { CITY_SOURCES, findSource } from "@/components/home/sources";
import type { StageSource } from "@/components/home/sources";
import { Stage } from "@/components/home/stage";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useSiteOrigin } from "@/hooks/use-site-origin";
import type { BackgroundGroup } from "@/lib/backgrounds";
import { trackEvent } from "@/lib/events";
import { cn } from "@/lib/utils";

/**
 * /backgrounds: a quiet gallery. The selected background plays on a big
 * stage with nothing over it, one row below says what it is and how to get
 * it, and every background follows as a card. The look knobs live in the
 * Studio. `?city=<id>` selects one and stays in the address bar as you
 * switch, so a link reopens the same scene. `[` and `]` step through them.
 */

const FIRST_ID = CITY_SOURCES[0]?.id ?? "";

const GROUP_LABEL = {
  cities: "City",
  landscapes: "Landscape",
} as const satisfies Record<BackgroundGroup, string>;

const installCommand = (origin: string, id: string) =>
  `npx shadcn@latest add ${origin}/r/${id}.json`;

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));

const CopyInstall = ({ source }: { source: StageSource }) => {
  const origin = useSiteOrigin();
  const { copyToClipboard, isCopied } = useCopyToClipboard({ timeout: 1500 });
  const command = installCommand(origin, source.id);
  return (
    <Button
      type="button"
      variant="outline"
      onClick={async () => {
        if (await copyToClipboard(command)) {
          trackEvent({
            name: "install_command_copied",
            properties: { component_name: source.id, section: "backgrounds" },
          });
        }
      }}
      title={command}
      aria-label={isCopied ? "Install command copied" : `Copy ${command}`}
      className="min-w-0 justify-start font-mono text-xs font-normal max-sm:w-full"
    >
      <Icon
        icon={isCopied ? Tick02Icon : Copy01Icon}
        className={cn("size-3.5", isCopied && "text-primary")}
      />
      <span className="truncate">{isCopied ? "Copied" : command}</span>
    </Button>
  );
};

export const BackgroundGallery = () => {
  const [selectedId, setSelectedId] = useState(FIRST_ID);
  const source = findSource(selectedId) ?? CITY_SOURCES[0];
  const stageRef = useRef<HTMLElement>(null);
  const index = source ? CITY_SOURCES.indexOf(source) : 0;

  // Read ?city= once on load; the server render shows the first scene.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("city");
    if (requested && findSource(requested)) {
      setSelectedId(requested);
    }
  }, []);

  // Keep the address bar in step, without adding history entries.
  useEffect(() => {
    if (!source) {
      return;
    }
    const url = new URL(window.location.href);
    if (url.searchParams.get("city") === source.id) {
      return;
    }
    url.searchParams.set("city", source.id);
    window.history.replaceState(window.history.state, "", url);
  }, [source]);

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
        setSelectedId(next.id);
      }
    };
    window.addEventListener("keydown", step);
    return () => window.removeEventListener("keydown", step);
  }, [index]);

  if (!source) {
    return null;
  }

  const show = (id: string) => {
    setSelectedId(id);
    stageRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  };

  return (
    <div className="flex flex-col gap-16 md:gap-24">
      <figure
        ref={stageRef}
        className="flex scroll-mt-24 flex-col gap-5"
        aria-label={`${source.title}, playing`}
      >
        <Stage
          source={source}
          className="h-[min(46svh,380px)] sm:h-[min(58svh,600px)]"
        />
        <figcaption className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
          <div className="flex max-w-2xl min-w-0 flex-col gap-1">
            <p className="flex items-baseline gap-3">
              <span className="text-xl font-medium tracking-[-0.02em]">
                {source.title}
              </span>
              <span className="text-muted-foreground text-sm">
                {GROUP_LABEL[source.group]}
              </span>
            </p>
            <p className="text-muted-foreground line-clamp-2 text-[15px] text-pretty">
              {source.description}
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2 lg:shrink-0 lg:flex-nowrap">
            <CopyInstall source={source} />
            <Button asChild variant="ghost">
              <Link href={source.href} transitionTypes={["nav-forward"]}>
                Docs
              </Link>
            </Button>
            <Button asChild variant="ghost" className="gap-1 pr-3">
              <Link href={`/studio?source=${source.id}`}>
                Open in Studio
                <Icon icon={ArrowRight01Icon} />
              </Link>
            </Button>
          </div>
        </figcaption>
      </figure>

      <section
        aria-labelledby="all-backgrounds"
        className="flex flex-col gap-6"
      >
        <h2
          id="all-backgrounds"
          className="flex items-baseline gap-3 text-xl font-medium tracking-[-0.02em]"
        >
          All backgrounds
          <span className="text-muted-foreground tabular text-sm font-normal">
            {CITY_SOURCES.length}
          </span>
        </h2>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {CITY_SOURCES.map((city) => {
            const selected = city.id === source.id;
            return (
              <li key={city.id}>
                <button
                  type="button"
                  onClick={() => show(city.id)}
                  aria-pressed={selected}
                  aria-label={`Show ${city.title}`}
                  className={cn(
                    "focus-visible:ring-ring/60 hover:border-foreground/25 flex w-full flex-col overflow-hidden rounded-[20px] border text-left outline-none transition-colors duration-150 focus-visible:ring-[3px]",
                    selected && "border-primary hover:border-primary"
                  )}
                >
                  <CityStill source={city} />
                  <span className="flex flex-col gap-x-3 border-t px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between">
                    <span className="truncate font-medium tracking-[-0.01em]">
                      {city.title}
                    </span>
                    <span
                      className={cn(
                        "text-muted-foreground text-sm",
                        selected && "text-primary"
                      )}
                    >
                      {selected ? "Playing" : GROUP_LABEL[city.group]}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
};
