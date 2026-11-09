"use client";

import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Copy01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { printSrc } from "@/components/home/city-still";
import {
  CITY_SOURCES,
  findSource,
  loadSource,
} from "@/components/home/sources";
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
 * /backgrounds: one background fills the screen under the floating nav, and
 * a dock at the bottom says what it is, how to get it, and switches between
 * all of them in place. The look knobs live in the Studio. `?city=<id>`
 * selects one and stays in the address bar as you switch, so a link reopens
 * the same scene. The arrow keys and `[` `]` step through them.
 */

const FIRST_ID = CITY_SOURCES[0]?.id ?? "";

const GROUP_LABEL = {
  cities: "City",
  landscapes: "Landscape",
} as const satisfies Record<BackgroundGroup, string>;

const PREVIOUS_KEYS = new Set(["[", "ArrowLeft"]);
const NEXT_KEYS = new Set(["]", "ArrowRight"]);

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));

// Arrow keys switch backgrounds only when nothing else has focus or focus is
// inside the viewer, so they never hijack the nav, search or a text field.
const ownsKeys = (target: EventTarget | null, viewer: HTMLElement | null) =>
  target === document.body ||
  (target instanceof Node &&
    viewer !== null &&
    viewer.contains(target) &&
    !isTyping(target));

const keyStep = (key: string) => {
  if (PREVIOUS_KEYS.has(key)) {
    return -1;
  }
  return NEXT_KEYS.has(key) ? 1 : 0;
};

// Start a background's chunk early; a failure just means the print stays.
const prefetch = async (source: StageSource) => {
  try {
    await loadSource(source);
  } catch {
    // The switch retries the load.
  }
};

// Keep the address bar in step, without adding history entries. Written on
// a switch, not from an effect, so the first render can't overwrite the
// ?city= it is about to read.
const writeCity = (id: string) => {
  const url = new URL(window.location.href);
  if (url.searchParams.get("city") !== id) {
    url.searchParams.set("city", id);
    window.history.replaceState(window.history.state, "", url);
  }
};

const installCommand = (origin: string, id: string) =>
  `npx shadcn@latest add ${origin}/r/${id}.json`;

const CopyInstall = ({ source }: { source: StageSource }) => {
  const origin = useSiteOrigin();
  const { copyToClipboard, isCopied } = useCopyToClipboard({ timeout: 1500 });
  const command = installCommand(origin, source.id);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
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
      className="shrink-0"
    >
      <Icon
        icon={isCopied ? Tick02Icon : Copy01Icon}
        className={cn("size-3.5", isCopied && "text-primary")}
      />
      <span className="hidden sm:inline">
        {isCopied ? "Copied" : "Copy install"}
      </span>
    </Button>
  );
};

export const BackgroundGallery = () => {
  const [selectedId, setSelectedId] = useState(FIRST_ID);
  const select = (id: string) => {
    setSelectedId(id);
    writeCity(id);
  };
  const source = findSource(selectedId) ?? CITY_SOURCES[0];
  const stripRef = useRef<HTMLUListElement>(null);
  const viewerRef = useRef<HTMLElement>(null);
  const index = source ? CITY_SOURCES.indexOf(source) : 0;
  const count = CITY_SOURCES.length;

  const step = (by: number) => {
    const next = CITY_SOURCES[(index + by + count) % count];
    if (next) {
      select(next.id);
    }
  };

  // Read ?city= once on load; the server render shows the first scene.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("city");
    if (requested && findSource(requested)) {
      setSelectedId(requested);
    }
  }, []);

  // Keep the selected thumbnail in view inside the strip, on a switch and
  // when the strip resizes. Scrolling the strip itself, not scrollIntoView,
  // so the page never jumps.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) {
      return;
    }
    const center = (smooth: boolean) => {
      const item = strip.children[index];
      if (!(item instanceof HTMLElement)) {
        return;
      }
      const left = item.offsetLeft - (strip.clientWidth - item.clientWidth) / 2;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
      strip.scrollTo({
        behavior: smooth && !reduce.matches ? "smooth" : "auto",
        left,
      });
    };
    center(true);
    const observer = new ResizeObserver(() => center(false));
    observer.observe(strip);
    return () => observer.disconnect();
  }, [index]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.defaultPrevented ||
        !ownsKeys(event.target, viewerRef.current)
      ) {
        return;
      }
      const by = keyStep(event.key);
      if (by === 0) {
        return;
      }
      event.preventDefault();
      const next = CITY_SOURCES[(index + by + count) % count];
      if (next) {
        setSelectedId(next.id);
        writeCity(next.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, count]);

  if (!source) {
    return null;
  }

  return (
    <section
      ref={viewerRef}
      aria-label={`${source.title}, background ${index + 1} of ${count}`}
      className="relative"
    >
      <Stage source={source} className="h-[calc(100svh-1rem)] min-h-[32rem]" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-2 sm:p-5">
        <div className="bg-background/85 supports-[backdrop-filter]:bg-background/70 pointer-events-auto flex w-full max-w-[60rem] flex-col gap-2.5 rounded-[18px] border p-2.5 shadow-[0_8px_32px_-12px_rgb(0_0_0/0.5)] backdrop-blur-md sm:gap-3 sm:p-3">
          <div className="flex items-center gap-3 pl-1.5">
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="flex items-baseline gap-2">
                <span className="truncate font-medium tracking-[-0.01em]">
                  {source.title}
                </span>
                <span className="text-muted-foreground shrink-0 text-sm">
                  {GROUP_LABEL[source.group]}
                </span>
              </p>
              <p className="text-muted-foreground hidden truncate text-sm md:block">
                {source.description}
              </p>
            </div>
            <CopyInstall source={source} />
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
            >
              <Link href={source.href} transitionTypes={["nav-forward"]}>
                Docs
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="gap-1">
              <Link href={`/studio?source=${source.id}`}>
                Studio
                <Icon icon={ArrowRight01Icon} className="size-3.5" />
              </Link>
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => step(-1)}
              aria-label="Previous background"
              className="hidden shrink-0 sm:inline-flex"
            >
              <Icon icon={ArrowLeft01Icon} />
            </Button>
            <ul
              ref={stripRef}
              aria-label="All backgrounds"
              className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto p-1"
            >
              {CITY_SOURCES.map((city) => {
                const selected = city.id === source.id;
                return (
                  <li key={city.id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => select(city.id)}
                      // Start the chunk on hover so the switch is instant.
                      onPointerEnter={() => prefetch(city)}
                      aria-pressed={selected}
                      aria-label={`${city.title}, ${GROUP_LABEL[city.group]}`}
                      title={city.title}
                      className={cn(
                        "bg-ascii-paper focus-visible:ring-ring/60 relative block h-9 w-16 overflow-hidden rounded-md opacity-60 outline-none transition-[opacity,box-shadow] duration-150 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-[3px] sm:h-10 sm:w-[4.5rem]",
                        selected &&
                          "ring-primary opacity-100 ring-2 focus-visible:ring-2"
                      )}
                    >
                      {/* oxlint-disable-next-line nextjs/no-img-element -- a static print, already sized and compressed */}
                      <img
                        src={printSrc(city)}
                        alt=""
                        decoding="async"
                        className="absolute inset-0 size-full object-cover"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => step(1)}
              aria-label="Next background"
              className="hidden shrink-0 sm:inline-flex"
            >
              <Icon icon={ArrowRight01Icon} />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
