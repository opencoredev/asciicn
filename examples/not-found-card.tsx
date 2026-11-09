import { NotFound } from "@/components/asciicn/not-found";
import { Button } from "@/components/ui/button";

export default function NotFoundCard() {
  return (
    <div className="bg-background w-full max-w-md overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <span className="text-sm font-medium">Projects</span>
        <span className="text-muted-foreground font-mono text-xs">atlas-7</span>
      </div>
      <NotFound
        compact
        titleAs="h3"
        title="No such project"
        description="It was renamed or deleted, or you lost access to it."
        path="~/projects/atlas-7"
        actions={<Button size="sm">All projects</Button>}
      />
    </div>
  );
}
