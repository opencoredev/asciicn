import { StatCard } from "@/components/asciicn/stat-card";

export default function StatCardCompact() {
  return (
    <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-3">
      <StatCard
        variant="compact"
        frame="light"
        label="Deploys"
        value={146}
        delta={4.3}
        deltaLabel="this week"
        trend={[12, 18, 15, 22, 19, 26, 24, 30]}
        color="green"
      />
      <StatCard
        variant="compact"
        frame="light"
        label="Open incidents"
        value={0}
        delta={0}
        deltaLabel="no change"
      />
      <StatCard
        variant="compact"
        frame="light"
        label="Queue depth"
        value={1204}
        trend={[640, 720, 910, 880, 1020, 1190, 1150, 1204]}
        color="orange"
      />
    </div>
  );
}
