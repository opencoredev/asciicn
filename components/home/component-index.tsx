import Link from "next/link";

import type { CatalogCategory } from "@/lib/catalog";

/**
 * Home: every component, grouped like a directory listing. Names come
 * straight from the docs tree, so counts and links are always real.
 */
export const ComponentIndex = ({
  catalog,
}: {
  catalog: readonly CatalogCategory[];
}) => (
  <div className="bg-rule border-rule grid gap-px border sm:grid-cols-2 lg:grid-cols-3">
    {catalog
      .filter((category) => category.pieces.length > 0)
      .map((category) => (
        <section
          key={category.id}
          aria-labelledby={`group-${category.id}`}
          className="bg-background flex flex-col gap-3 p-4 sm:p-5"
        >
          <header className="flex items-baseline justify-between gap-3">
            <h3
              id={`group-${category.id}`}
              className="text-foreground font-mono text-[15px]"
            >
              {category.id}
              <span className="text-faint">/</span>
            </h3>
            <span className="text-ink tabular font-mono text-[13px]">
              {category.pieces.length}
            </span>
          </header>
          {category.description ? (
            <p className="text-muted-foreground text-[13px] leading-snug text-pretty">
              {category.description}
            </p>
          ) : null}
          <ul className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-1 font-mono text-[12.5px]">
            {category.pieces.map((piece) => (
              <li key={piece.url}>
                <Link
                  href={piece.url}
                  title={piece.description}
                  className="text-muted-foreground hover:text-ink focus-visible:outline-ring transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {piece.url.split("/").at(-1)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
  </div>
);
