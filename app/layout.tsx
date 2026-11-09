import type { Metadata } from "next";
import Script from "next/script";

import { Analytics } from "@/components/analytics";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { META_THEME_COLORS } from "@/constants/site";
import { CAPLESS_KEY, CAPLESS_SCRIPT } from "@/lib/analytics/config";
import { fontVariables } from "@/lib/fonts";
import { JsonLdScripts } from "@/seo/json-ld";

import "@/styles/globals.css";
import { baseMetadata } from "@/seo/metadata";

export const metadata: Metadata = baseMetadata;

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => (
  // Font variables sit on <html> so :root tokens like --ascii-font resolve.
  <html lang="en" className={fontVariables} suppressHydrationWarning>
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
      {CAPLESS_KEY ? (
        <script async src={CAPLESS_SCRIPT} data-key={CAPLESS_KEY} />
      ) : null}
    </head>
    <body className="text-foreground group/body overscroll-none font-sans antialiased [font-feature-settings:'ss01','cv11'] [--footer-height:--spacing(14)] [--header-height:--spacing(18)] xl:[--footer-height:--spacing(24)]">
      <ThemeProvider>
        {children}
        <Toaster position="top-center" />
        <Analytics />
      </ThemeProvider>
    </body>
  </html>
);

export default RootLayout;
