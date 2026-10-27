import { AsciiButton } from "@/components/asciicn/ascii-button";
import { NotFound } from "@/components/asciicn/not-found";

export default function NotFoundCompact() {
  return (
    <div className="bg-background ring-border w-full max-w-md rounded-xl ring-1">
      <NotFound
        titleAs="h2"
        animate={false}
        cell={3}
        depth={2}
        color="grey"
        fill="dotted"
        title="Project not found"
        description="It may have been deleted, or you may not have access."
        actions={
          <AsciiButton size="sm" variant="outline" color="grey">
            See all projects
          </AsciiButton>
        }
        className="py-10 [&_h2]:text-lg"
      />
    </div>
  );
}
