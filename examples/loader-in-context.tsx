import { Loader } from "@/components/asciicn/loader";
import { Button } from "@/components/ui/button";

export default function LoaderInContext() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <div className="bg-background flex items-center gap-3 rounded-lg border px-4 py-3">
        <Loader color="blue" label="Deploying" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-medium">Deploying to production</span>
          <span className="text-muted-foreground truncate font-mono text-xs">
            main · 8e52937
          </span>
        </div>
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          0:42
        </span>
      </div>
      <div className="bg-background flex items-center justify-between gap-3 rounded-lg border px-4 py-3 font-mono text-xs">
        <Loader
          variant="wave"
          size="sm"
          color="green"
          label="Streaming logs"
          showLabel
        />
        <span className="text-muted-foreground tabular-nums">1,204 lines</span>
      </div>
      <div className="bg-background flex flex-col items-center gap-4 rounded-lg border px-4 py-8">
        <Loader
          variant="comet"
          size="lg"
          color="purple"
          label="Waiting for the first event"
        />
        <div className="flex flex-col items-center gap-0.5 text-center">
          <span className="text-sm font-medium">Listening for events</span>
          <span className="text-muted-foreground text-xs">
            Send a test webhook to see it here.
          </span>
        </div>
        <Button size="sm" variant="outline" disabled>
          <Loader size="sm" color="currentColor" label="Sending" />
          Sending test event
        </Button>
      </div>
    </div>
  );
}
