import { AsciiBadge } from "@/components/asciicn/ascii-badge";

export default function AsciiBadgeShapes() {
  return (
    <div className="flex w-full max-w-md flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <AsciiBadge tone="ok">OK</AsciiBadge>
        <AsciiBadge shape="angle" tone="accent">
          beta
        </AsciiBadge>
        <AsciiBadge shape="round" tone="info">
          new
        </AsciiBadge>
        <AsciiBadge shape="pipe">v2.4</AsciiBadge>
        <AsciiBadge shape="inverse" tone="warn">
          DEPRECATED
        </AsciiBadge>
      </div>
      <div className="flex flex-col gap-2 text-sm">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium">Command palette</span>
          <AsciiBadge shape="round" tone="info">
            new
          </AsciiBadge>
        </p>
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium">Team spaces</span>
          <AsciiBadge shape="angle" tone="accent">
            beta
          </AsciiBadge>
        </p>
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium">Live sync</span>
          <AsciiBadge tone="ok" dot>
            live
          </AsciiBadge>
        </p>
      </div>
    </div>
  );
}
