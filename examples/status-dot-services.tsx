import { StatusDot } from "@/components/asciicn/status-dot";
import type { StatusDotState } from "@/components/asciicn/status-dot";

const SERVICES = [
  { latency: "84 ms", name: "api.acme.dev", status: "online" },
  { latency: "212 ms", name: "search.acme.dev", status: "busy" },
  { latency: "n/a", name: "jobs.acme.dev", status: "error" },
  { latency: "n/a", name: "legacy.acme.dev", status: "offline" },
] as const satisfies readonly {
  latency: string;
  name: string;
  status: StatusDotState;
}[];

const LABELS = {
  busy: "Degraded",
  error: "Down",
  offline: "Retired",
  online: "Operational",
} as const satisfies Record<StatusDotState, string>;

export default function StatusDotServices() {
  return (
    <table className="w-full max-w-md text-left font-mono text-xs">
      <thead className="text-muted-foreground">
        <tr>
          <th className="pb-2 font-normal">Service</th>
          <th className="pb-2 font-normal">Status</th>
          <th className="pb-2 text-right font-normal">Latency</th>
        </tr>
      </thead>
      <tbody>
        {SERVICES.map((service) => (
          <tr key={service.name} className="border-border border-t">
            <td className="py-2.5">{service.name}</td>
            <td className="py-2.5">
              <StatusDot
                status={service.status}
                label={LABELS[service.status]}
                variant="braille"
              />
            </td>
            <td className="text-muted-foreground py-2.5 text-right tabular-nums">
              {service.latency}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
