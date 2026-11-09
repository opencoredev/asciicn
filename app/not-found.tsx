import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import type { Metadata } from "next";
import Link from "next/link";

import { NotFound } from "@/components/asciicn/not-found";
import { Icon } from "@/components/icon";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = {
  robots: { follow: true, index: false },
  title: "Page not found",
};

/**
 * The site's 404, for unknown URLs and for `notFound()` anywhere below.
 * It renders inside the root layout only, so it brings its own top bar.
 * That bar is a plain link home: the full SiteHeader here breaks hydration
 * of the real header on every page under `next dev`.
 */
const NotFoundPage = () => (
  <div className="bg-background relative flex min-h-svh flex-col">
    <header className="flex h-(--header-height) items-end justify-center px-3 pb-2">
      <Link
        href={ROUTES.HOME}
        className="focus-visible:ring-ring/50 flex h-12 items-center rounded-full px-4 outline-none focus-visible:ring-[3px]"
      >
        <Wordmark />
      </Link>
    </header>
    <main className="flex flex-1 flex-col items-center justify-center pb-[var(--header-height)]">
      <NotFound
        actions={
          <>
            <Button
              asChild
              size="lg"
              // Same trims as the hero's primary button: the chevron sits
              // inside 6px of empty viewBox.
              className="h-11 gap-1 rounded-full pt-px pr-[15.5px] pl-5 text-[0.95rem] has-[>svg]:pr-[15.5px] has-[>svg]:pl-5 motion-safe:active:scale-100"
            >
              <Link href={ROUTES.HOME}>
                Back home
                <Icon icon={ArrowRight01Icon} />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="bg-foreground/[0.04] hover:bg-foreground/[0.08] border-foreground/15 h-11 rounded-full px-5 pb-px text-[0.95rem] motion-safe:active:scale-100"
            >
              <Link href={ROUTES.DOCS_EXAMPLES}>Browse components</Link>
            </Button>
          </>
        }
      />
    </main>
  </div>
);

export default NotFoundPage;
