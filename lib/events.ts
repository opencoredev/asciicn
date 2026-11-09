import { track } from "@vercel/analytics";
import { posthog } from "posthog-js";
import { z } from "zod";

import { CAPLESS_KEY } from "@/lib/analytics/config";

const eventSchema = z.object({
  name: z.enum([
    // Product events the PostHog dashboard reads.
    "agent_prompt_copied",
    "install_command_copied",
    "component_code_copied",
    "shader_control_tweaked",
    "example_card_clicked",
    "github_link_clicked",
    "theme_toggled",
    "search_performed",
    // Older events, still sent.
    "copy_color",
    "open_command_menu",
    "click_edit_page",
    "keyboard_shortcut_navigate",
  ]),
  properties: z
    .record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null()])
    )
    .optional(),
});

export type Event = z.infer<typeof eventSchema>;
export type EventName = Event["name"];
export type EventProperties = NonNullable<Event["properties"]>;

const DOCS_PATH = /^\/docs\/([^/]+)\/([^/#?]+)/;

/**
 * The docs page an event happened on, as the component and its group, e.g.
 * /docs/scenes/ascii-donut -> { category: "scenes", component_name: "ascii-donut" }.
 */
export const pageContext = (): EventProperties => {
  if (typeof window === "undefined") {
    return {};
  }
  const match = DOCS_PATH.exec(window.location.pathname);
  return match
    ? { category: match[1] ?? null, component_name: match[2] ?? null }
    : {};
};

// Vercel Web Analytics drops string values over 255 characters.
const VERCEL_MAX = 255;
const forVercel = (properties: EventProperties) =>
  Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [
      key,
      typeof value === "string" ? value.slice(0, VERCEL_MAX) : value,
    ])
  );

type Capless = (
  command: "track",
  name: string,
  properties: EventProperties
) => void;

// The Capless tag defines window.capless once it loads; until then this stub
// queues calls the way its docs describe, so early events aren't lost.
const capless: Capless = (...args) => {
  const target = window as Window & {
    capless?: Capless & { q?: unknown[][] };
  };
  if (!target.capless) {
    const queue: unknown[][] = [];
    const stub: Capless & { q?: unknown[][] } = (...queued) => {
      queue.push(queued);
    };
    stub.q = queue;
    target.capless = stub;
  }
  target.capless(...args);
};

export const trackEvent = (input: Event): void => {
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) {
    return;
  }
  const { name, properties = {} } = parsed.data;
  posthog.capture(name, properties);
  track(name, forVercel(properties));
  if (CAPLESS_KEY && typeof window !== "undefined") {
    capless("track", name, properties);
  }
};
