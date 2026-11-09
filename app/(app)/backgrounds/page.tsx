import { BackgroundGallery } from "@/components/home/background-gallery";
import { SiteFooter } from "@/components/site-footer";
import { ROUTES } from "@/constants/routes";
import { BACKGROUNDS } from "@/lib/backgrounds";
import { BreadcrumbJsonLd } from "@/seo/json-ld";
import { createPageMetadata } from "@/seo/metadata";

export const dynamic = "force-static";
export const revalidate = false;

const TITLE = "ASCII backgrounds";
const DESCRIPTION = `${BACKGROUNDS.length} animated backgrounds for React, cities and painted landscapes drawn in real glyphs. Switch charsets, colours and CRT effects live, then install one with the shadcn CLI or export the frame.`;

export const metadata = createPageMetadata({
  description: DESCRIPTION,
  ogImage: `${ROUTES.OG}?${new URLSearchParams({ description: DESCRIPTION, title: TITLE })}`,
  path: ROUTES.BACKGROUNDS,
  title: TITLE,
});

export default function BackgroundsPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: ROUTES.HOME },
          { name: "Backgrounds", path: ROUTES.BACKGROUNDS },
        ]}
      />
      <div className="container-wrapper pt-6 pb-20 md:pb-28">
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
            <div className="flex flex-col gap-2">
              <p className="text-faint flex items-center gap-3 font-mono text-[11px]">
                <span className="text-ink tabular">{BACKGROUNDS.length}</span>
                components/asciicn/
              </p>
              <h1 className="font-display text-[2rem] leading-[1.06] tracking-[-0.035em] sm:text-[2.6rem]">
                Backgrounds
              </h1>
            </div>
            <p className="text-muted-foreground max-w-xl text-[15px] text-pretty">
              Cities and landscapes painted in glyph dots. Each is one component
              you can put behind a hero, and each takes every charset, colour
              mode and CRT effect. Point at the stage to read any glyph.
            </p>
          </header>
          <BackgroundGallery />
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
