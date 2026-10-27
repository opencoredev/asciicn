import { EmptyState } from "@/components/asciicn/empty-state";
import { Button } from "@/components/ui/button";

export default function EmptyStatePanel() {
  return (
    <div className="bg-background w-full max-w-xl overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <span className="text-sm font-medium">API keys</span>
        <span className="text-muted-foreground font-mono text-xs">
          0 active
        </span>
      </div>
      <EmptyState
        color="green"
        illustration="folder"
        title="No API keys"
        description="Create a key to call the API from your server. Keys are shown once, so store them somewhere safe."
        action={<Button size="sm">Create key</Button>}
      />
    </div>
  );
}
