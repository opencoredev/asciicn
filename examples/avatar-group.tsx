import { Avatar, AvatarGroup } from "@/components/asciicn/avatar";

const VIEWERS = [
  "Ada Lovelace",
  "Alan Turing",
  "Grace Hopper",
  "Edsger Dijkstra",
  "Barbara Liskov",
  "Ken Thompson",
  "Radia Perlman",
  "Donald Knuth",
  "Frances Allen",
] as const;

export default function AvatarGroupExample() {
  return (
    <div className="bg-background flex w-full max-w-sm flex-col gap-4 rounded-lg border p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">Q3 launch plan</span>
          <span className="text-muted-foreground text-xs">
            Edited 4 minutes ago
          </span>
        </div>
        <AvatarGroup max={4} size="sm" aria-label="9 viewers">
          {VIEWERS.map((name) => (
            <Avatar key={name} name={name} />
          ))}
        </AvatarGroup>
      </div>
      <div className="flex items-center justify-between gap-4 border-t pt-4">
        <span className="text-muted-foreground text-xs">Shared with</span>
        <AvatarGroup
          max={6}
          size={28}
          outline="var(--background)"
          aria-label="9 people"
        >
          {VIEWERS.map((name) => (
            <Avatar key={name} name={name} charset="quadrants" />
          ))}
        </AvatarGroup>
      </div>
    </div>
  );
}
