import { AsciiBox } from "@/components/asciicn/ascii-box";

const PROCESSES = [
  ["node", "212", "38.2%"],
  ["postgres", "88", "12.7%"],
  ["redis", "41", "3.1%"],
] as const;

export default function AsciiBoxPanels() {
  return (
    <AsciiBox
      title="htop · prod-eu-1"
      frame="heavy"
      className="w-full max-w-2xl"
    >
      <div className="grid gap-[var(--box-ch)] sm:grid-cols-2">
        <AsciiBox title="cpu" color="green" padding={0} className="w-full">
          <p className="font-mono text-sm">
            <span className="text-[var(--ascii-color-green)]">████████▌</span>
            <span className="text-muted-foreground">░░░░░ 62%</span>
          </p>
        </AsciiBox>
        <AsciiBox title="memory" color="blue" padding={0} className="w-full">
          <p className="font-mono text-sm">
            <span className="text-[var(--ascii-color-blue)]">█████▍</span>
            <span className="text-muted-foreground">░░░░░░░░ 41%</span>
          </p>
        </AsciiBox>
        <AsciiBox
          title="processes"
          footer="3 of 118"
          labelAlign="end"
          padding={0}
          className="w-full sm:col-span-2"
        >
          <table className="w-full font-mono text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="text-left font-normal">name</th>
                <th className="text-right font-normal">pid</th>
                <th className="text-right font-normal">cpu</th>
              </tr>
            </thead>
            <tbody>
              {PROCESSES.map(([name, pid, cpu]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td className="text-right">{pid}</td>
                  <td className="text-right">{cpu}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AsciiBox>
      </div>
    </AsciiBox>
  );
}
