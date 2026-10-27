import { TorusKnot } from "@/components/asciicn/torus-knot";

export default function TorusKnotTrefoil() {
  return (
    <div className="grid w-full max-w-xl grid-cols-[1fr_auto] items-center gap-6">
      <div className="space-y-2 font-mono text-sm">
        <p className="text-muted-foreground">$ knot --p 2 --q 3</p>
        <p>trefoil, crossing number 3</p>
        <p className="text-muted-foreground">
          The simplest knot that can't be untied.
        </p>
      </div>
      <TorusKnot
        p={2}
        q={3}
        thickness={0.24}
        charset="dense"
        colorMode="mono"
        background="transparent"
        interactive={false}
        cell={9}
        className="size-48"
      />
    </div>
  );
}
