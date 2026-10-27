/**
 * Kbd: a keycap. A 1px-ruled block with a heavier bottom edge, set in mono.
 *
 *   <Kbd>⌘</Kbd><Kbd>K</Kbd>    or    <Kbd keys={["⌘", "K"]} />
 *
 * Props
 * - `keys`: render several caps in a row (alternative to `children`).
 * - `size`: "sm" (18px, default) or "md" (22px).
 * - all other `kbd` props.
 */

import { cn } from "@/lib/utils";

export interface KbdProps extends React.ComponentProps<"kbd"> {
  /** Several keys as one chord; each gets its own cap. */
  keys?: readonly string[];
  /** Cap height: "sm" is 18px, "md" is 22px. Default "sm". */
  size?: "sm" | "md";
}

const CAP =
  "border-rule bg-background text-muted-foreground inline-flex items-center justify-center rounded-xs border border-b-2 font-mono leading-none font-normal select-none in-data-[slot=tooltip-content]:border-background/30 in-data-[slot=tooltip-content]:bg-transparent in-data-[slot=tooltip-content]:text-background";

const SIZES = {
  md: "h-[22px] min-w-[22px] px-1.5 text-xs",
  sm: "h-[18px] min-w-[18px] px-1 text-[10px]",
} as const satisfies Record<NonNullable<KbdProps["size"]>, string>;

export const Kbd = ({
  keys,
  size = "sm",
  className,
  children,
  ...props
}: KbdProps) => {
  if (keys) {
    return (
      <kbd
        data-slot="kbd-group"
        className={cn("inline-flex items-center gap-0.5", className)}
        {...props}
      >
        {keys.map((key) => (
          <kbd key={key} className={cn(CAP, SIZES[size])}>
            {key}
          </kbd>
        ))}
      </kbd>
    );
  }
  return (
    <kbd data-slot="kbd" className={cn(CAP, SIZES[size], className)} {...props}>
      {children}
    </kbd>
  );
};
