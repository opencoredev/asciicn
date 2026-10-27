import { cn } from "@/lib/utils";

const Kbd = ({ className, ...props }: React.ComponentProps<"kbd">) => (
  <kbd
    data-slot="kbd"
    className={cn(
      "pointer-events-none inline-flex h-[18px] w-fit min-w-[18px] items-center justify-center gap-1 rounded-xs border border-b-2 border-rule bg-background px-1 font-mono text-[10px]/none font-normal text-muted-foreground select-none [&_svg:not([class*='size-'])]:size-3",
      "in-data-[slot=tooltip-content]:border-background/30 in-data-[slot=tooltip-content]:bg-transparent in-data-[slot=tooltip-content]:text-background",
      className
    )}
    {...props}
  />
);

const KbdGroup = ({ className, ...props }: React.ComponentProps<"div">) => (
  <kbd
    data-slot="kbd-group"
    className={cn("inline-flex items-center gap-1", className)}
    {...props}
  />
);

export { Kbd, KbdGroup };
