// The PostHog project token comes from the environment only. With no
// NEXT_PUBLIC_POSTHOG_KEY set, PostHog stays off: the browser never inits it
// and the proxy sends no server events. The token is public by design (it
// only writes events), but it must belong to the asciicn project.
export const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";

/** Whether PostHog has a project to write to. */
export const POSTHOG_ENABLED = POSTHOG_KEY !== "";

export const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

/** First-party path the browser sends events to; next.config.mjs proxies it. */
export const POSTHOG_PROXY_PATH = "/ingest";

export const POSTHOG_UI_HOST = "https://us.posthog.com";

// Capless (web analytics and session replay) also comes from the environment
// only, so a fork or a local run sends nothing. The key is public and can
// only write events.
export const CAPLESS_KEY = process.env.NEXT_PUBLIC_CAPLESS_KEY ?? "";

export const CAPLESS_SCRIPT = "https://c.capless.sh/c.js";
