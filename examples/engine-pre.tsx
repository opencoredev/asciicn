import { AsciiPre, BOX, eighthsBar, MutableFrame } from "@/lib/ascii";

// A status panel built with MutableFrame and rendered as real text on the
// server. Select it: it copies as text.
const panel = () => {
  const width = 38;
  const frame = new MutableFrame(width, 7, { color: true });
  const box = BOX.rounded;
  const dim: readonly [number, number, number] = [130, 130, 150];
  frame.write(0, 0, `${box.tl}${box.h.repeat(width - 2)}${box.tr}`, dim);
  for (let y = 1; y < 6; y += 1) {
    frame.put(0, y, box.v, dim);
    frame.put(width - 1, y, box.v, dim);
  }
  frame.write(0, 6, `${box.bl}${box.h.repeat(width - 2)}${box.br}`, dim);
  frame.write(2, 0, " ascii-core ", [255, 176, 0]);
  const rows = [
    ["cpu", 0.62, [51, 255, 102]],
    ["gpu", 0.84, [56, 189, 248]],
    ["mem", 0.37, [255, 176, 0]],
  ] as const;
  for (const [index, [label, value, color]] of rows.entries()) {
    frame.write(2, index + 2, label, dim);
    frame.write(7, index + 2, eighthsBar(value, 22), color);
    frame.write(30, index + 2, `${Math.round(value * 100)}%`.padStart(4));
  }
  return frame;
};

export default function EnginePre() {
  return <AsciiPre frame={panel()} cell={16} className="select-text" />;
}
