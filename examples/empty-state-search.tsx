import { Search01Icon } from "@hugeicons/core-free-icons";

import { EmptyState } from "@/components/asciicn/empty-state";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";

export default function EmptyStateSearch() {
  return (
    <div className="bg-background w-full max-w-md overflow-hidden rounded-lg border">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Icon icon={Search01Icon} className="text-muted-foreground size-4" />
        <span className="font-mono text-sm">brialle</span>
      </div>
      <EmptyState
        illustration="search"
        color="orange"
        title="No results for “brialle”"
        description="Check the spelling, or search for a shorter phrase."
        action={
          <Button size="sm" variant="outline">
            Clear search
          </Button>
        }
        className="py-8"
      />
    </div>
  );
}
