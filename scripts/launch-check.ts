/**
 * Launch check: crawls a running asciicn server and counts the problems a
 * visitor or an agent would hit on launch day. Every problem prints one
 * `ISSUE` line; the last line is the total, so 0 means ready.
 *
 * HTTP pass (every sitemap page): status, title, description, canonical,
 * og:image that loads, a Markdown twin, internal links that resolve, every
 * registry item, the agent surfaces and a 404 page that leads back home.
 *
 * Browser pass (key pages, at 1440 and 390 wide, through agent-browser):
 * console errors, page errors, horizontal overflow and serious or critical
 * axe violations.
 *
 *   LAUNCH_URL=http://localhost:3000 pnpm launch:check
 *   LAUNCH_SKIP_BROWSER=1 pnpm launch:check   # HTTP pass only
 */
import { execFileSync } from "node:child_process";

const BASE = (process.env.LAUNCH_URL ?? "http://localhost:3000").replace(
  /\/$/,
  ""
);
const SESSION = process.env.LAUNCH_SESSION ?? "asciicn-launch-check";
const SKIP_BROWSER = process.env.LAUNCH_SKIP_BROWSER === "1";
const CONCURRENCY = 6;

const issues: string[] = [];
let score = 0;
// One point per problem; an axe rule counts once per failing element.
const issue = (kind: string, where: string, detail = "", weight = 1) => {
  issues.push(`ISSUE ${kind} ${where}${detail ? ` ${detail}` : ""}`);
  score += weight;
};

const toLocal = (url: string) => {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}`;
};

const get = async (path: string, init?: RequestInit) => {
  try {
    const response = await fetch(`${BASE}${path}`, {
      redirect: "follow",
      ...init,
    });
    const body = await response.text();
    return { body, response };
  } catch (error) {
    return { body: "", error: String(error), response: undefined };
  }
};

const pool = async <T>(items: T[], work: (item: T) => Promise<void>) => {
  const queue = [...items];
  const runners = Array.from({ length: CONCURRENCY }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      await work(item);
    }
  });
  await Promise.all(runners);
};

const attr = (html: string, pattern: RegExp) => pattern.exec(html)?.[1] ?? "";

const internalLinks = new Set<string>();

const checkHead = (path: string, body: string) => {
  if (!attr(body, /<title[^>]*>([^<]*)<\/title>/).trim()) {
    issue("no-title", path);
  }
  if (!/<meta[^>]+name="description"[^>]+content="[^"]+"/.test(body)) {
    issue("no-description", path);
  }
  if (!/<link[^>]+rel="canonical"/.test(body)) {
    issue("no-canonical", path);
  }
  if (!/<h1[\s>]/.test(body)) {
    issue("no-h1", path);
  }
};

const checkOgImage = async (path: string, body: string) => {
  const ogImage = attr(
    body,
    /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/
  );
  if (!ogImage) {
    issue("no-og-image", path);
    return;
  }
  const og = await get(toLocal(ogImage.replaceAll("&amp;", "&")));
  const type = og.response?.headers.get("content-type") ?? "";
  if (og.response?.status !== 200 || !type.startsWith("image/")) {
    issue("og-image", path, `${og.response?.status} ${type}`);
  }
};

const checkMarkdownTwin = async (path: string) => {
  const markdown = await get(path, { headers: { Accept: "text/markdown" } });
  const type = markdown.response?.headers.get("content-type") ?? "";
  if (
    markdown.response?.status !== 200 ||
    !type.includes("markdown") ||
    markdown.body.trim().length < 80
  ) {
    issue("markdown-twin", path, `${markdown.response?.status} ${type}`);
  }
};

const collectLinks = (body: string) => {
  for (const match of body.matchAll(/href="(\/[^"#]*)(?:#[^"]*)?"/g)) {
    const href = match[1]?.replaceAll("&amp;", "&") ?? "";
    if (href && !href.startsWith("/_next/") && !href.startsWith("//")) {
      internalLinks.add(href);
    }
  }
};

const checkPage = async (path: string) => {
  const { body, response } = await get(path);
  if (!response || response.status !== 200) {
    issue("page-status", path, String(response?.status ?? "fetch failed"));
    return;
  }
  checkHead(path, body);
  collectLinks(body);
  await checkOgImage(path, body);
  await checkMarkdownTwin(path);
};

const checkLink = async (href: string) => {
  const { response } = await get(href);
  if (!response || response.status >= 400) {
    issue("broken-link", href, String(response?.status ?? "fetch failed"));
  }
};

const checkRegistry = async () => {
  const { body, response } = await get("/r/registry.json");
  if (response?.status !== 200) {
    issue("registry-index", "/r/registry.json", String(response?.status));
    return;
  }
  const index = JSON.parse(body) as { items?: { name: string }[] };
  const names = (index.items ?? []).map((item) => item.name);
  if (names.length === 0) {
    issue("registry-empty", "/r/registry.json");
  }
  await pool(names, async (name) => {
    const item = await get(`/r/${name}.json`);
    if (item.response?.status !== 200) {
      issue("registry-item", `/r/${name}.json`, String(item.response?.status));
      return;
    }
    try {
      const parsed = JSON.parse(item.body) as {
        files?: { content?: string }[];
      };
      if (parsed.files?.some((file) => !file.content?.trim())) {
        issue("registry-empty-file", `/r/${name}.json`);
      }
    } catch {
      issue("registry-json", `/r/${name}.json`);
    }
  });
};

const AGENT_SURFACES = [
  "/llms.txt",
  "/llms-full.txt",
  "/robots.txt",
  "/sitemap.xml",
  "/openapi.json",
  "/rss.xml",
  "/manifest.webmanifest",
  "/.well-known/agent-skills/asciicn/SKILL.md",
] as const;

const checkNotFound = async () => {
  const path = "/launch-check-missing-page";
  const { body, response } = await get(path);
  if (response?.status !== 404) {
    issue("404-status", path, String(response?.status));
  }
  if (!/<a[^>]+href="\/"/.test(body)) {
    issue("404-no-way-home", path);
  }
};

const browser = (...args: string[]) => {
  try {
    return execFileSync("agent-browser", args, {
      encoding: "utf-8",
      env: { ...process.env, AGENT_BROWSER_SESSION: SESSION },
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 90_000,
    });
  } catch (error) {
    const failed = error as { stdout?: string };
    return failed.stdout ?? "";
  }
};

interface ConsoleMessage {
  type?: string;
  text?: string;
}

interface AxeViolation {
  id: string;
  impact?: string;
  nodeCount?: number;
}

// Console noise from dev tooling, not from the site.
const IGNORED_CONSOLE = [/React DevTools/, /\[HMR\]/, /Fast Refresh/];

const BROWSER_PAGES = [
  "/",
  "/docs",
  "/studio",
  "/backgrounds",
  "/about",
  "/docs/installation",
] as const;

interface BrowserReply<T> {
  success?: boolean;
  data?: T | null;
  error?: string;
}

/**
 * Runs an agent-browser command with `--json`. A command that fails, or
 * answers without data, counts as an issue and returns null, so a broken
 * audit can never pass as a clean page.
 */
const browserJson = <T>(where: string, ...args: string[]): T | null => {
  const command = args[0] ?? "";
  try {
    const reply = JSON.parse(browser(...args, "--json")) as BrowserReply<T>;
    if (reply.success === true && reply.data) {
      return reply.data;
    }
    issue("browser-failed", where, `${command}: ${reply.error ?? "no data"}`);
  } catch {
    issue("browser-failed", where, `${command}: unreadable reply`);
  }
  return null;
};

const errorText = (error: unknown) => {
  if (typeof error === "string") {
    return error;
  }
  const { message, text } = (error ?? {}) as {
    message?: string;
    text?: string;
  };
  return message ?? text ?? JSON.stringify(error);
};

const checkConsole = (where: string) => {
  const log = browserJson<{ messages?: ConsoleMessage[] }>(where, "console");
  if (!log) {
    return;
  }
  if (!Array.isArray(log.messages)) {
    issue("browser-failed", where, "console: no messages list");
    return;
  }
  for (const message of log.messages) {
    const text = message.text ?? "";
    if (
      message.type === "error" &&
      !IGNORED_CONSOLE.some((pattern) => pattern.test(text))
    ) {
      issue("console-error", where, text.slice(0, 160).replaceAll("\n", " "));
    }
  }
};

const checkPageErrors = (where: string) => {
  const reply = browserJson<{ errors?: unknown[] }>(where, "errors");
  if (!reply) {
    return;
  }
  if (!Array.isArray(reply.errors)) {
    issue("browser-failed", where, "errors: no errors list");
    return;
  }
  for (const error of reply.errors) {
    issue("page-error", where, errorText(error).slice(0, 160));
  }
};

const checkOverflow = (where: string) => {
  const reply = browserJson<{ result?: unknown }>(
    where,
    "eval",
    "document.documentElement.scrollWidth - window.innerWidth"
  );
  if (!reply) {
    return;
  }
  if (typeof reply.result !== "number") {
    issue("browser-failed", where, "eval: no overflow number");
  } else if (reply.result > 1) {
    issue("overflow", where, `${reply.result}px`);
  }
};

const checkA11y = (where: string) => {
  const audit = browserJson<{ violations?: AxeViolation[] }>(where, "a11y");
  if (!audit) {
    return;
  }
  if (!Array.isArray(audit.violations)) {
    issue("browser-failed", where, "a11y: no violations list");
    return;
  }
  for (const violation of audit.violations) {
    if (violation.impact === "serious" || violation.impact === "critical") {
      issue(
        "a11y",
        where,
        `${violation.id} x${violation.nodeCount ?? 1} (${violation.impact})`,
        violation.nodeCount ?? 1
      );
    }
  }
};

const checkInBrowser = (path: string, width: number, height: number) => {
  const where = `${path}@${width}`;
  browserJson(where, "set", "viewport", String(width), String(height));
  browserJson(where, "console", "--clear");
  browserJson(where, "errors", "--clear");
  if (!browserJson(where, "open", `${BASE}${path}`)) {
    return;
  }
  browser("wait", "2500");
  // Walk the page so lazy sections mount, then come back to the top.
  browser(
    "eval",
    "(async()=>{for(let y=0;y<document.body.scrollHeight;y+=600){scrollTo(0,y);await new Promise(r=>setTimeout(r,120))}scrollTo(0,0)})()"
  );
  browser("wait", "1500");

  checkOverflow(where);
  checkConsole(where);
  checkPageErrors(where);

  // Accessibility once per page, at desktop width.
  if (width >= 1000) {
    checkA11y(where);
  }
};

const main = async () => {
  const sitemap = await get("/sitemap.xml");
  const pages = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (match) => toLocal(match[1] ?? "/")
  );
  if (pages.length === 0) {
    issue("sitemap-empty", "/sitemap.xml");
  }

  await pool(pages, checkPage);
  const pageSet = new Set(pages);
  await pool(
    [...internalLinks].filter((href) => !pageSet.has(href)),
    checkLink
  );
  await checkRegistry();
  await pool([...AGENT_SURFACES], async (path) => {
    const { response } = await get(path);
    if (response?.status !== 200) {
      issue("agent-surface", path, String(response?.status));
    }
  });
  await checkNotFound();

  if (!SKIP_BROWSER) {
    for (const path of BROWSER_PAGES) {
      checkInBrowser(path, 1440, 900);
      checkInBrowser(path, 390, 844);
    }
    browser("close");
  }

  for (const line of issues.toSorted()) {
    process.stdout.write(`${line}\n`);
  }
  process.stdout.write(
    `pages=${pages.length} links=${internalLinks.size} issues=${issues.length}\n${score}\n`
  );
};

await main();
