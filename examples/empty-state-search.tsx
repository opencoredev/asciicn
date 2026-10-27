import { Search01Icon } from "@hugeicons/core-free-icons";

import { AsciiButton } from "@/components/asciicn/ascii-button";
import { EmptyState } from "@/components/asciicn/empty-state";
import { Icon } from "@/components/icon";

export default function EmptyStateSearch() {
  return (
    <div className="bg-background ring-border w-full max-w-md overflow-hidden rounded-xl ring-1">
      <div className="border-border flex items-center gap-2 border-b px-4 py-3">
        <Icon icon={Search01Icon} className="text-muted-foreground size-4" />
        <span className="font-mono text-sm">ditehr</span>
      </div>
      <EmptyState
        illustration="search"
        color="grey"
        title="No results for “ditehr”"
        description="Check the spelling, or search for a shorter phrase."
        action={
          <AsciiButton size="sm" variant="outline" color="grey">
            Clear search
          </AsciiButton>
        }
        className="py-8"
      />
    </div>
  );
}
