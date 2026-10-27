import { LOGO_CELLS, LOGO_RUNS } from "@/components/logo";
import { SITE } from "@/constants/site";

/** Satori markup shared by /og and /og/docs/*. Hex colours only. */
const INK = "#000000";
const PAPER = "#fafafa";
const AMBER = "#fcb442";
const MUTED = "#a3a3a3";

// A glyph ramp along the bottom edge: density rises left to right, with a
// little per-row jitter so it reads as type, not a gradient.
const RAMP = " .:-=+*#%@";
const COLS = 50;
const ROWS = 4;
const GLYPH_W = 1200 / COLS;
const GLYPH_H = 24;

const rampGlyph = (col: number, row: number) => {
  const jitter = (((col * 7 + row * 13) % 5) - 2) * 0.04;
  const level = Math.min(Math.max(col / (COLS - 1) + jitter, 0), 1);
  return RAMP[Math.round(level * (RAMP.length - 1))];
};

const Ramp = () => (
  <div
    style={{
      bottom: 0,
      color: AMBER,
      display: "flex",
      flexDirection: "column",
      fontSize: 20,
      left: 0,
      position: "absolute",
      width: 1200,
    }}
  >
    {Array.from({ length: ROWS }, (_row, row) => (
      <div key={row} style={{ display: "flex", height: GLYPH_H }}>
        {Array.from({ length: COLS }, (_col, col) => (
          <div
            key={col}
            style={{
              display: "flex",
              justifyContent: "center",
              width: GLYPH_W,
            }}
          >
            {rampGlyph(col, row)}
          </div>
        ))}
      </div>
    ))}
  </div>
);

const MARK_CELL = 6;

const Mark = () => (
  <svg
    width={LOGO_CELLS * MARK_CELL}
    height={LOGO_CELLS * MARK_CELL}
    viewBox={`0 0 ${LOGO_CELLS} ${LOGO_CELLS}`}
  >
    {LOGO_RUNS.map(({ x, y, width }) => (
      <rect
        key={`${x}-${y}`}
        x={x}
        y={y}
        width={width}
        height="1"
        fill={AMBER}
      />
    ))}
  </svg>
);

export const OgCard = ({
  title,
  description,
}: {
  title: string;
  description?: string;
}) => (
  <div
    style={{
      background: INK,
      color: PAPER,
      display: "flex",
      flexDirection: "column",
      height: "100%",
      padding: "72px 80px",
      position: "relative",
      width: "100%",
    }}
  >
    <div
      style={{
        alignItems: "center",
        color: AMBER,
        display: "flex",
        fontSize: 32,
        gap: 16,
      }}
    >
      <Mark />
      {SITE.NAME}
    </div>
    <div
      style={{
        display: "flex",
        fontSize: title.length > 28 ? 64 : 80,
        fontWeight: 600,
        letterSpacing: "-0.035em",
        lineHeight: 1.04,
        marginTop: 56,
        maxWidth: 980,
      }}
    >
      {title}
    </div>
    {description ? (
      <div
        style={{
          color: MUTED,
          display: "flex",
          fontSize: 32,
          lineHeight: 1.4,
          marginTop: 28,
          maxWidth: 940,
        }}
      >
        {description}
      </div>
    ) : null}
    <Ramp />
  </div>
);
