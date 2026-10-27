import { Matrix } from "@/components/asciicn/matrix";

export default function MatrixTerminal() {
  return (
    <div className="relative isolate flex size-full items-center justify-center p-6">
      <Matrix density={0.55} depth={0.7} className="absolute inset-0 -z-10" />
      <div className="bg-background/85 w-full max-w-sm rounded-xl border p-4 font-mono text-sm backdrop-blur-sm">
        <p className="text-muted-foreground">$ ssh operator@relay-07</p>
        <p>Connected. 3 jobs waiting in the queue.</p>
        <p className="text-muted-foreground">
          Last login: Tue 27 Oct, 09:14 from 10.0.4.12
        </p>
      </div>
    </div>
  );
}
