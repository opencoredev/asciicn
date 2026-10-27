import type { AsciiHandle, Rgb8 } from "@/lib/ascii";
import { downloadBlob, toAnsi, toPng, toSvg, toText } from "@/lib/ascii/export";

/**
 * Save the frame on a stage as .txt, .ans, .svg or .png, through the
 * engine's `ascii-export` functions. Site glue: picks the file type and
 * turns the handle's CSS colours into the hex the file formats want.
 */

export type ExportFormat = "txt" | "ans" | "svg" | "png";

export const EXPORT_FORMATS = [
  "txt",
  "ans",
  "svg",
  "png",
] as const satisfies readonly ExportFormat[];

// Theme colours arrive as any CSS colour (oklch, color-mix). A 1px canvas
// resolves them to bytes, which every file format can hold.
const cssToRgb = (css: string): Rgb8 => {
  const context = document.createElement("canvas").getContext("2d");
  if (!context) {
    return [255, 255, 255];
  }
  context.fillStyle = css;
  context.fillRect(0, 0, 1, 1);
  const [r = 255, g = 255, b = 255] = context.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
};

const cssToHex = (css: string) =>
  `#${cssToRgb(css)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;

const textBlob = (text: string, type = "text/plain;charset=utf-8") =>
  new Blob([text], { type });

/** The file for one format, or null when the stage has nothing to save. */
export const exportFrame = async (
  handle: AsciiHandle | null,
  format: ExportFormat
): Promise<Blob | null> => {
  const frame = handle?.capture();
  if (!handle || !frame) {
    return null;
  }
  const { ink, paper } = handle.colors();
  switch (format) {
    case "txt": {
      return textBlob(`${toText(frame, { trimEnd: true })}\n`);
    }
    case "ans": {
      return textBlob(
        `${toAnsi(frame, { ink: cssToRgb(ink), trimEnd: true })}\n`
      );
    }
    case "svg": {
      return textBlob(
        toSvg(frame, {
          ink: cssToHex(ink),
          metrics: handle.metrics() ?? undefined,
          paper: paper ? cssToHex(paper) : null,
        }),
        "image/svg+xml;charset=utf-8"
      );
    }
    case "png": {
      // Re-rendered from the glyphs, so it is sharp at any size and doesn't
      // depend on the WebGL buffer still holding the frame.
      return await toPng(handle, {
        scale: Math.max(2, window.devicePixelRatio),
      });
    }
    default: {
      const exhaustive: never = format;
      return exhaustive;
    }
  }
};

export const downloadFile = downloadBlob;
