"use client";

import { useEffect } from "react";

import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";

type ToolExecute = (
  input: unknown,
  options: { signal: AbortSignal }
) => Promise<unknown>;

interface ModelContextApi {
  registerTool?: (
    def: {
      description: string;
      execute: ToolExecute;
      inputSchema: Record<string, unknown>;
      name: string;
    },
    options?: { signal: AbortSignal }
  ) => (() => void) | undefined;
}

const STUDIO_PATH = ROUTES.STUDIO;
// The app pages outside /docs an agent can be sent to.
const APP_PAGES = [ROUTES.STUDIO, ROUTES.BACKGROUNDS] as const;

const getPath = (input: unknown, fallback: string): string => {
  if (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    typeof (input as { path: unknown }).path === "string"
  ) {
    return (input as { path: string }).path;
  }

  return fallback;
};

export const WebMcpTools = () => {
  useEffect(() => {
    const { modelContext } = navigator as Navigator & {
      modelContext?: ModelContextApi;
    };
    const registerTool = modelContext?.registerTool;
    if (typeof registerTool !== "function") {
      return;
    }

    const ac = new AbortController();
    const cleanups: (() => void)[] = [];

    const register = (def: {
      description: string;
      execute: ToolExecute;
      inputSchema: Record<string, unknown>;
      name: string;
    }) => {
      // A detached method call throws "Illegal invocation" in Chrome.
      const maybeCleanup = registerTool.call(modelContext, def, {
        signal: ac.signal,
      });
      if (typeof maybeCleanup === "function") {
        cleanups.push(maybeCleanup);
      }
    };

    register({
      description: `Navigate this tab to a ${SITE.NAME} documentation path (e.g. /docs/installation).`,
      execute: (input) => {
        const path = getPath(input, ROUTES.DOCS);
        window.location.assign(path);

        return Promise.resolve({ ok: true, path });
      },
      inputSchema: {
        properties: {
          path: {
            description: "Path beginning with /docs",
            type: "string",
          },
        },
        type: "object",
      },
      name: `${SITE.NAME}_open_docs`,
    });

    register({
      description: `Open the ${SITE.NAME} ASCII Studio (/studio), where a background or component can be restyled and exported, or the gallery of animated ASCII city backgrounds (/backgrounds).`,
      execute: (input) => {
        const path = getPath(input, STUDIO_PATH);
        const target = APP_PAGES.find((page) => page === path) ?? STUDIO_PATH;
        window.location.assign(target);

        return Promise.resolve({ ok: true, path: target });
      },
      inputSchema: {
        properties: {
          path: {
            description: "Which page to open",
            enum: [...APP_PAGES],
            type: "string",
          },
        },
        type: "object",
      },
      name: `${SITE.NAME}_open_page`,
    });

    register({
      description:
        "Fetch the published shadcn registry manifest (registry.json) for this site.",
      execute: async (_input, { signal }) => {
        const res = await fetch(`${window.location.origin}${ROUTES.REGISTRY}`, {
          signal,
        });
        if (!res.ok) {
          return { ok: false, status: res.status };
        }

        return res.json();
      },
      inputSchema: { properties: {}, type: "object" },
      name: `${SITE.NAME}_fetch_registry`,
    });

    register({
      description: "Open the llms.txt documentation index for this site.",
      execute: () => {
        window.location.assign(ROUTES.LLMS);

        return Promise.resolve({ ok: true, path: ROUTES.LLMS });
      },
      inputSchema: { properties: {}, type: "object" },
      name: `${SITE.NAME}_open_llms_index`,
    });

    return () => {
      ac.abort();
      for (const fn of cleanups) {
        fn();
      }
    };
  }, []);

  return null;
};
