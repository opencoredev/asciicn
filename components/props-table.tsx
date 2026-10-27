import { cn } from "@/lib/utils";

export interface PropRow {
  name: string;
  type: string;
  /** Omit for required props. */
  default?: string;
  description: string;
  required?: boolean;
}

/**
 * Component props as a table: mono names, muted types, defaults. Below the
 * `sm` breakpoint each row stacks into a block so nothing scrolls sideways.
 *
 * ```mdx
 * <PropsTable rows={[{ name: "speed", type: "number", default: "1", description: "Time multiplier." }]} />
 * ```
 */
export const PropsTable = ({
  rows,
  className,
}: {
  rows: PropRow[];
  className?: string;
}) => (
  <div
    className={cn(
      "bg-card text-card-foreground not-first:mt-4 overflow-hidden rounded-sm border",
      className
    )}
  >
    <table className="w-full border-collapse text-left text-sm max-sm:block">
      <thead className="max-sm:sr-only">
        <tr className="label-caps text-muted-foreground bg-muted/50">
          <th scope="col" className="w-[38%] px-4 py-2 font-normal">
            Prop
          </th>
          <th scope="col" className="px-4 py-2 font-normal">
            Type
          </th>
          <th scope="col" className="w-[18%] px-4 py-2 font-normal">
            Default
          </th>
        </tr>
      </thead>
      <tbody className="max-sm:block">
        {rows.map((row) => (
          <tr
            key={row.name}
            className="border-t align-top first:border-t-0 max-sm:block max-sm:px-4 max-sm:py-4 sm:first:border-t"
          >
            <th
              scope="row"
              className="px-4 py-3 font-normal max-sm:block max-sm:p-0"
            >
              <span className="text-ink font-mono text-[13px]">
                {row.name}
                {row.required ? (
                  <span className="text-muted-foreground" aria-label="required">
                    *
                  </span>
                ) : null}
              </span>
              <p className="text-muted-foreground mt-1 font-sans text-[13px] leading-relaxed text-pretty">
                {row.description}
              </p>
            </th>
            <td className="px-4 py-3 max-sm:mt-2 max-sm:block max-sm:p-0">
              <span className="sr-only sm:hidden">Type: </span>
              <code className="text-muted-foreground font-mono text-xs break-words">
                {row.type}
              </code>
            </td>
            <td className="px-4 py-3 max-sm:mt-1 max-sm:block max-sm:p-0">
              <span className="text-muted-foreground text-xs sm:hidden">
                Default{" "}
              </span>
              <code className="text-foreground/80 font-mono text-xs">
                {row.default ?? "–"}
              </code>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
