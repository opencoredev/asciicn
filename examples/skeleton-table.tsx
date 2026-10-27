import { Skeleton } from "@/components/asciicn/skeleton";

const ROWS = [0, 1, 2, 3, 4];

export default function SkeletonTable() {
  return (
    <div
      aria-busy="true"
      className="bg-background w-full max-w-xl overflow-hidden rounded-lg border"
    >
      <span className="sr-only">Loading members</span>
      <div className="text-muted-foreground grid grid-cols-[1fr_6rem_5rem] gap-4 border-b px-5 py-3 text-xs font-medium">
        <span>Member</span>
        <span>Role</span>
        <span className="text-right">Last seen</span>
      </div>
      {ROWS.map((row) => (
        <div
          key={row}
          className="grid grid-cols-[1fr_6rem_5rem] items-center gap-4 border-b px-5 py-3 last:border-b-0"
        >
          <div className="flex items-center gap-3">
            <Skeleton shape="circle" size={2} />
            <Skeleton
              rows={1}
              style={{ width: `${48 + ((row * 17) % 30)}%` }}
            />
          </div>
          <Skeleton rows={1} className="w-14" />
          <Skeleton rows={1} className="ml-auto w-12" />
        </div>
      ))}
    </div>
  );
}
