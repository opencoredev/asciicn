import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUpRight01Icon,
} from "@hugeicons/core-free-icons";
import { findNeighbour } from "fumadocs-core/page-tree";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DocsCopyPage } from "@/components/docs-copy-page";
import { DocsKeyboardShortcuts } from "@/components/docs-keyboard-shortcuts";
import { DocsNavLink } from "@/components/docs-nav-link";
import { DocsShareMenu } from "@/components/docs-share-menu";
import { DocsTableOfContents } from "@/components/docs-toc";
import { DocsTocFooter } from "@/components/docs-toc-footer";
import { Icon } from "@/components/icon";
import { PageTransition } from "@/components/page-transition";
import { badgeVariants } from "@/components/ui/badge";
import { ROUTES } from "@/constants/routes";
import { formatTitleFromSlug } from "@/lib/docs";
import { getPageImage, getPageMarkdownUrl, source } from "@/lib/source";
import { absoluteUrl } from "@/lib/utils";
import { mdxComponents } from "@/mdx-components";
import { BreadcrumbJsonLd } from "@/seo/json-ld";
import { createPageMetadata } from "@/seo/metadata";

export const revalidate = false;
export const dynamic = "force-static";
export const dynamicParams = false;

export const generateStaticParams = () => source.generateParams();

export const generateMetadata = async (props: {
  params: Promise<{ slug?: string[] }>;
}) => {
  const params = await props.params;
  const page = source.getPage(params.slug);

  if (!page) {
    notFound();
  }

  const doc = page.data;
  const ogImage = getPageImage(page).url;

  return createPageMetadata({
    description: doc.description,
    ogImage,
    ogType: "article",
    path: page.url,
    title: doc.title,
  });
};

const buildBreadcrumbs = (
  slugs: string[],
  pageTitle: string,
  pageUrl: string
) => {
  const items: { name: string; path: string }[] = [{ name: "Home", path: "/" }];

  if (slugs.length === 0) {
    items.push({ name: pageTitle, path: pageUrl });
    return items;
  }

  items.push({ name: "Docs", path: ROUTES.DOCS });

  let currentPath = ROUTES.DOCS;
  for (let i = 0; i < slugs.length - 1; i += 1) {
    currentPath += `/${slugs[i]}`;
    items.push({ name: formatTitleFromSlug(slugs[i]), path: currentPath });
  }

  items.push({ name: pageTitle, path: pageUrl });
  return items;
};

type Neighbour = ReturnType<typeof findNeighbour>["previous"];

/** Previous and next pages as two ruled cells under the article. */
const DocsPager = ({
  previous,
  next,
}: {
  previous: Neighbour;
  next: Neighbour;
}) =>
  previous || next ? (
    <nav
      aria-label="Pager"
      className="mx-auto mt-6 mb-10 grid w-full max-w-[44rem] grid-cols-2 border-y px-4 md:px-0"
    >
      {previous ? (
        <Link
          href={previous.url}
          transitionTypes={["nav-back"]}
          className="group/pager hover:bg-accent flex flex-col gap-1 py-3 pr-4 transition-colors duration-150"
        >
          <span className="label-caps text-muted-foreground">← Previous</span>
          <span className="text-foreground truncate text-sm">
            {previous.name}
          </span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={next.url}
          transitionTypes={["nav-forward"]}
          className="group/pager hover:bg-accent flex flex-col items-end gap-1 border-l py-3 pl-4 text-right transition-colors duration-150"
        >
          <span className="label-caps text-muted-foreground">Next →</span>
          <span className="text-foreground truncate text-sm">{next.name}</span>
        </Link>
      ) : null}
    </nav>
  ) : null;

const Page = async (props: { params: Promise<{ slug?: string[] }> }) => {
  const params = await props.params;
  const page = source.getPage(params.slug);

  if (!page) {
    notFound();
  }

  const doc = page.data;
  const MdxContent = doc.body;
  const neighbours = findNeighbour(source.pageTree, page.url);
  const markdownUrl = getPageMarkdownUrl(page).url;

  const { links } = doc as { links?: { doc?: string; api?: string } };
  const breadcrumbs = buildBreadcrumbs(params.slug ?? [], doc.title, page.url);

  return (
    <>
      <BreadcrumbJsonLd items={breadcrumbs} />

      <DocsKeyboardShortcuts
        previous={neighbours.previous ? neighbours.previous.url : null}
        next={neighbours.next ? neighbours.next.url : null}
      />

      <PageTransition>
        <div
          data-slot="docs"
          className="flex items-stretch text-[15px] xl:w-full"
        >
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="h-(--top-spacing) shrink-0" />
            <div className="text-foreground/85 mx-auto flex w-full max-w-[44rem] min-w-0 flex-1 flex-col gap-8 px-4 py-6 md:px-0 lg:py-8">
              <header className="flex flex-col gap-3">
                <nav
                  aria-label="Breadcrumb"
                  className="text-muted-foreground flex min-w-0 items-center gap-1.5 overflow-hidden font-mono text-xs whitespace-nowrap"
                >
                  {breadcrumbs.slice(1, -1).map((crumb) => (
                    <span
                      key={crumb.path}
                      className="flex items-center gap-1.5"
                    >
                      <Link
                        href={crumb.path}
                        className="hover:text-foreground lowercase transition-colors duration-150"
                      >
                        {crumb.name}
                      </Link>
                      <span aria-hidden className="text-faint">
                        /
                      </span>
                    </span>
                  ))}
                  <span className="text-foreground truncate">
                    {(params.slug ?? []).at(-1) ?? "index"}.mdx
                  </span>
                </nav>
                <h1 className="font-display text-foreground scroll-m-20 text-[1.75rem] leading-[1.15] font-medium tracking-[-0.035em] text-balance [font-stretch:87.5%] xl:text-[2rem]">
                  {doc.title}
                </h1>
                {doc.description && (
                  <p className="text-muted-foreground max-w-[60ch] font-sans text-base text-pretty">
                    {doc.description}
                  </p>
                )}
                <div className="docs-nav mt-1 flex h-9 items-center gap-1 border-y">
                  <div className="hidden sm:block">
                    <DocsCopyPage
                      markdownUrl={absoluteUrl(markdownUrl)}
                      url={absoluteUrl(page.url)}
                    />
                  </div>
                  <DocsShareMenu
                    title={doc.title}
                    url={absoluteUrl(page.url)}
                  />
                  <div className="ml-auto flex gap-1">
                    {neighbours.previous && (
                      <DocsNavLink
                        href={neighbours.previous.url}
                        transitionTypes={["nav-back"]}
                        className="extend-touch-target size-7"
                        tooltip={{
                          icon: <Icon icon={ArrowLeft01Icon} />,
                          title: "Previous page",
                        }}
                      >
                        <span className="sr-only">Previous</span>
                      </DocsNavLink>
                    )}
                    {neighbours.next && (
                      <DocsNavLink
                        href={neighbours.next.url}
                        transitionTypes={["nav-forward"]}
                        className="extend-touch-target size-7"
                        tooltip={{
                          icon: <Icon icon={ArrowRight01Icon} />,
                          title: "Next page",
                        }}
                      >
                        <span className="sr-only">Next</span>
                      </DocsNavLink>
                    )}
                  </div>
                </div>
                {links ? (
                  <div className="flex items-center gap-2 pt-1">
                    {links?.doc && (
                      <Link
                        href={links.doc}
                        target="_blank"
                        rel="noreferrer"
                        className={badgeVariants({ variant: "secondary" })}
                      >
                        Docs
                        <Icon icon={ArrowUpRight01Icon} className="-mr-0.5" />
                      </Link>
                    )}
                    {links?.api && (
                      <Link
                        href={links.api}
                        target="_blank"
                        rel="noreferrer"
                        className={badgeVariants({ variant: "secondary" })}
                      >
                        API Reference
                        <Icon icon={ArrowUpRight01Icon} className="-mr-0.5" />
                      </Link>
                    )}
                  </div>
                ) : null}
              </header>
              <div className="w-full flex-1 font-sans text-[15px] leading-relaxed *:data-[slot=alert]:first:mt-0">
                <MdxContent components={mdxComponents} />
              </div>
            </div>
            <DocsPager previous={neighbours.previous} next={neighbours.next} />
          </div>
          <div className="sticky top-(--header-height) z-30 ml-auto hidden h-[calc(100svh-var(--header-height))] w-64 shrink-0 flex-col gap-4 overflow-hidden overscroll-none border-l pb-6 xl:flex">
            <div className="h-(--top-spacing) shrink-0" />
            {doc.toc?.length ? (
              <div className="no-scrollbar overflow-y-auto px-5">
                <DocsTableOfContents toc={doc.toc} />
              </div>
            ) : null}
            <DocsTocFooter markdownUrl={markdownUrl} className="mt-auto px-5" />
          </div>
        </div>
      </PageTransition>
    </>
  );
};

export default Page;
