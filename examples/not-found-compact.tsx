import { NotFound } from "@/components/asciicn/not-found";
import { Button } from "@/components/ui/button";

export default function NotFoundCompact() {
  return (
    <div className="bg-background w-full max-w-md rounded-lg border">
      <NotFound
        titleAs="h2"
        animate={false}
        cell={9}
        depth={1}
        color="grey"
        title="Project not found"
        description="It may have been deleted, or you may not have access."
        actions={
          <Button size="sm" variant="outline">
            See all projects
          </Button>
        }
        className="gap-4 py-8 [&_h2]:text-lg"
      />
    </div>
  );
}
