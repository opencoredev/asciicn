import { SITE } from "@/constants/site";

/**
 * Satori markup shared by /og and /og/docs/*: a terminal pane in the site's
 * phosphor palette. A column ruler on top, the title in Martian Mono, and a
 * field of real glyphs (Cascadia Mono) on the right that ramps from blank
 * to `@`. Hex colours only; Satori has no OKLCH.
 */
const GRAPHITE = "#121513";
const RULE = "#2b302c";
const FAINT = "#5d665f";
const MUTED = "#a9b1aa";
const PAPER = "#eef1ee";
const INK = "#61f381";

const RAMP = " .:-=+*#%@";
const FIELD_COLUMNS = 30;
const FIELD_ROWS = 22;

/** Two interfering ripples around an off-centre point, as glyph rows. */
const glyphField = (): string[] =>
  Array.from({ length: FIELD_ROWS }, (_, row) => {
    let line = "";
    for (let column = 0; column < FIELD_COLUMNS; column += 1) {
      // Cells are about twice as tall as wide; scale x to keep rings round.
      const x = (column - FIELD_COLUMNS * 0.48) / 2.1;
      const y = row - FIELD_ROWS * 0.52;
      const radius = Math.hypot(x, y);
      const wave = Math.cos(radius * 0.9) * 0.5 + 0.5;
      const falloff = Math.max(0, 1 - radius / 13);
      const tone = Math.min(1, wave * falloff * 1.25 + falloff * 0.15);
      line += RAMP[Math.round(tone * (RAMP.length - 1))] ?? " ";
    }
    return line;
  });

const FIELD = glyphField();

const RULER = Array.from({ length: 96 }, (_, index) => {
  const position = index + 1;
  if (position % 10 === 0) {
    return String((position / 10) % 10);
  }
  return position % 5 === 0 ? ":" : ".";
}).join("");

/** Every character the card draws in each face, so fonts can be subset. */
export const ogCardText = (title: string, description?: string) => ({
  display: `${SITE.NAME}${title}`,
  mono: `${RULER}${FIELD.join("")}${description ?? ""}${SITE.NAME}.dev/·×0123456789 docscharsetcellsglyphs`,
});

/**
 * Fetches a Google font subset as TrueType for Satori. Returns null when the
 * network fails, so the card still renders in the fallback face.
 */
export const loadGoogleFont = async (
  family: string,
  axes: string,
  text: string
): Promise<ArrayBuffer | null> => {
  try {
    const sheet = await fetch(
      `https://fonts.googleapis.com/css2?family=${family.replaceAll(" ", "+")}${axes}&text=${encodeURIComponent(text)}`
    );
    const css = await sheet.text();
    const url = /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/u.exec(
      css
    )?.[1];
    if (!url) {
      return null;
    }
    const response = await fetch(url);
    return response.ok ? await response.arrayBuffer() : null;
  } catch {
    return null;
  }
};

/** Fonts for `ImageResponse`, skipping any that failed to load. */
export const ogCardFonts = async (title: string, description?: string) => {
  const text = ogCardText(title, description);
  const [display, mono] = await Promise.all([
    loadGoogleFont("Martian Mono", ":wdth,wght@87.5,500", text.display),
    loadGoogleFont("Cascadia Mono", "", text.mono),
  ]);
  return [
    ...(display
      ? [
          {
            data: display,
            name: "Martian Mono",
            style: "normal" as const,
            weight: 500 as const,
          },
        ]
      : []),
    ...(mono
      ? [
          {
            data: mono,
            name: "Cascadia Mono",
            style: "normal" as const,
            weight: 400 as const,
          },
        ]
      : []),
  ];
};

const MARK_RECTS = [
  [0, 0, 4, 2],
  [0, 0, 2, 5],
  [8, 0, 4, 2],
  [10, 0, 2, 5],
  [0, 18, 4, 2],
  [0, 15, 2, 5],
  [8, 18, 4, 2],
  [10, 15, 2, 5],
] as const;

export const OgCard = ({
  title,
  description,
  path,
}: {
  title: string;
  description?: string;
  /** Shown in the status line, e.g. "docs/backgrounds/silk". */
  path?: string;
}) => (
  <div
    style={{
      background: GRAPHITE,
      color: PAPER,
      display: "flex",
      flexDirection: "column",
      fontFamily: "Cascadia Mono",
      height: "100%",
      position: "relative",
      width: "100%",
    }}
  >
    <div
      style={{
        borderBottom: `1px solid ${RULE}`,
        color: FAINT,
        display: "flex",
        fontSize: 15,
        height: 28,
        letterSpacing: "0.02em",
        overflow: "hidden",
        paddingLeft: 12,
        paddingTop: 6,
        whiteSpace: "pre",
      }}
    >
      {RULER}
    </div>
    <div style={{ display: "flex", flex: 1 }}>
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          padding: "56px 0 0 72px",
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            fontFamily: "Martian Mono",
            fontSize: 30,
            gap: 16,
          }}
        >
          <svg width="20" height="34" viewBox="0 0 12 20" fill={PAPER}>
            {MARK_RECTS.map(([x, y, w, h]) => (
              <rect key={`${x}-${y}-${w}`} x={x} y={y} width={w} height={h} />
            ))}
            <rect x="3" y="9" width="6" height="8" fill={INK} />
          </svg>
          {SITE.NAME}
        </div>
        <div
          style={{
            display: "flex",
            fontFamily: "Martian Mono",
            fontSize: title.length > 24 ? 56 : 72,
            letterSpacing: "-0.04em",
            lineHeight: 1.08,
            marginTop: 64,
            maxWidth: 640,
          }}
        >
          {title}
        </div>
        {description ? (
          <div
            style={{
              color: MUTED,
              display: "flex",
              fontSize: 24,
              lineHeight: 1.45,
              marginTop: 28,
              maxWidth: 600,
            }}
          >
            {description}
          </div>
        ) : null}
      </div>
      <div
        style={{
          borderLeft: `1px solid ${RULE}`,
          color: INK,
          display: "flex",
          flexDirection: "column",
          fontSize: 20,
          lineHeight: 1.2,
          padding: "20px 24px",
          whiteSpace: "pre",
        }}
      >
        {FIELD.map((line, index) => (
          // Rows are fixed for the life of the module.
          // oxlint-disable-next-line react/no-array-index-key
          <div key={index} style={{ display: "flex" }}>
            {line}
          </div>
        ))}
      </div>
    </div>
    <div
      style={{
        alignItems: "center",
        borderTop: `1px solid ${RULE}`,
        color: MUTED,
        display: "flex",
        fontSize: 16,
        gap: 14,
        height: 40,
        padding: "0 20px",
      }}
    >
      <div
        style={{
          background: INK,
          color: GRAPHITE,
          display: "flex",
          padding: "2px 8px",
        }}
      >
        {SITE.NAME}.dev
      </div>
      <div style={{ color: FAINT, display: "flex" }}>·</div>
      <div style={{ display: "flex" }}>{path ?? "docs"}</div>
      <div style={{ display: "flex", flex: 1 }} />
      <div style={{ display: "flex" }}>
        charset classic · {FIELD_COLUMNS}×{FIELD_ROWS} cells
      </div>
    </div>
  </div>
);
