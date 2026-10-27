import { Sparkline } from "@/components/asciicn/sparkline";

const PAGES = [
  {
    path: "/pricing",
    trend: [
      320, 341, 338, 362, 390, 377, 412, 431, 428, 466, 481, 503, 512, 534,
    ],
    views: "6,129",
  },
  {
    path: "/docs/installation",
    trend: [
      410, 402, 396, 421, 418, 409, 431, 426, 438, 433, 441, 437, 452, 449,
    ],
    views: "5,963",
  },
  {
    path: "/blog/glyph-charts",
    trend: [80, 96, 141, 388, 512, 446, 371, 302, 265, 231, 214, 198, 187, 176],
    views: "4,107",
  },
  {
    path: "/changelog",
    trend: [
      262, 251, 244, 238, 229, 233, 218, 211, 206, 199, 203, 191, 187, 180,
    ],
    views: "3,052",
  },
] as const;

export default function SparklineTable() {
  return (
    <div className="border-border bg-background w-full max-w-xl overflow-hidden border font-mono">
      <table className="w-full text-xs">
        <caption className="border-border text-muted-foreground border-b px-3 py-1.5 text-left text-[11px] tracking-[0.08em] uppercase">
          top pages · 14d
        </caption>
        <thead>
          <tr className="text-muted-foreground border-border border-b">
            <th scope="col" className="px-3 py-2 text-left font-normal">
              Page
            </th>
            <th scope="col" className="px-3 py-2 text-left font-normal">
              Trend
            </th>
            <th scope="col" className="px-3 py-2 text-right font-normal">
              Views
            </th>
          </tr>
        </thead>
        <tbody>
          {PAGES.map((page) => (
            <tr
              key={page.path}
              className="border-border border-b last:border-0"
            >
              <td className="px-3 py-2.5">{page.path}</td>
              <td className="px-3 py-2.5">
                <Sparkline
                  data={page.trend}
                  label={`Daily views of ${page.path}`}
                  className="text-sm"
                />
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {page.views}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
