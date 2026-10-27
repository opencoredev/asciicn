import type { Metadata } from "next";
import Script from "next/script";

import { Analytics } from "@/components/analytics";
import { DEFAULT_PALETTE, PALETTE_SCRIPT } from "@/components/terminal/palette";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { META_THEME_COLORS } from "@/constants/site";
import { fontVariables } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { JsonLdScripts } from "@/seo/json-ld";

import "@/styles/globals.css";
import { baseMetadata } from "@/seo/metadata";

export const metadata: Metadata = baseMetadata;

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => (
  // Font variables sit on <html> so :root tokens like --ascii-font can use them.
  <html
    lang="en"
    data-palette={DEFAULT_PALETTE}
    className={fontVariables}
    suppressHydrationWarning
  >
    <head>
      <JsonLdScripts />
      <meta name="theme-color" content={META_THEME_COLORS.dark} />
      <Script
        id="theme-color"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `
              try {
                if (localStorage.theme === 'light' || (localStorage.theme === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.querySelector('meta[name="theme-color"]').setAttribute('content', '${META_THEME_COLORS.light}')
                }
              } catch (_) {}
            `,
        }}
      />
      {/* Applies the stored palette before first paint, so it never
          flashes. A raw inline script: next/script defers inline code until
          Next boots, which is after paint. */}
      <script
        // oxlint-disable-next-line react/no-danger -- a fixed, build-time string
        dangerouslySetInnerHTML={{ __html: PALETTE_SCRIPT }}
      />
    </head>
    <body
      className={cn(
        "text-foreground group/body overscroll-none font-mono antialiased [--footer-height:--spacing(10)] [--header-height:--spacing(14)]"
      )}
    >
      <ThemeProvider>
        {children}
        <Toaster position="top-center" />
        <Analytics />
      </ThemeProvider>
    </body>
  </html>
);

export default RootLayout;
