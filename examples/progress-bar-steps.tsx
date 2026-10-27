import { ProgressBar } from "@/components/asciicn/progress-bar";

const TASKS = [
  { done: true, label: "Create a project" },
  { done: true, label: "Connect a repository" },
  { done: true, label: "Add a custom domain" },
  { done: false, label: "Invite your team" },
  { done: false, label: "Turn on alerts" },
] as const;

const done = TASKS.filter((task) => task.done).length;

export default function ProgressBarSteps() {
  return (
    <div className="bg-background border-border flex w-full max-w-sm flex-col gap-5 rounded-lg border p-5">
      <ProgressBar
        label="Getting started"
        value={done}
        max={TASKS.length}
        valueText={`${done} of ${TASKS.length}`}
        segments={TASKS.length}
        color="orange"
        size="lg"
      />
      <ul className="flex flex-col gap-2 text-sm">
        {TASKS.map((task) => (
          <li key={task.label} className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className={
                task.done
                  ? "text-ascii-orange font-mono"
                  : "text-muted-foreground font-mono"
              }
            >
              {task.done ? "■" : "□"}
            </span>
            <span
              className={
                task.done
                  ? "text-muted-foreground line-through"
                  : "text-foreground"
              }
            >
              {task.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
