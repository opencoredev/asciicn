import { BackgroundGallery } from "@/components/home/background-gallery";
import { SiteFooter } from "@/components/site-footer";
import { ROUTES } from "@/constants/routes";
import { BACKGROUNDS } from "@/lib/backgrounds";
import { BreadcrumbJsonLd } from "@/seo/json-ld";
import { createPageMetadata } from "@/seo/metadata";

export const dynamic = "force-static";
export const revalidate = false;

const TITLE = "ASCII backgrounds";
const DESCRIPTION = `${BACKGROUNDS.length} animated backgrounds for React, cities and painted landscapes drawn in real glyphs. Each one is a component you install with the shadcn CLI.`;

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
      <div className="container-wrapper pt-8 pb-20 md:pt-10 md:pb-28">
        <div className="flex flex-col gap-8 md:gap-10">
          <header className="flex max-w-3xl flex-col gap-3">
            <h1 className="text-4xl leading-[1.05] font-medium tracking-[-0.04em] text-balance sm:text-5xl">
              Backgrounds
            </h1>
            <p className="text-muted-foreground text-lg text-pretty">
              {BACKGROUNDS.length} cities and landscapes drawn in glyphs. Each
              one is a component you put behind a hero.
            </p>
          </header>
          <BackgroundGallery />
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
