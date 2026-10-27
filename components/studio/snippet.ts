/**
 * The copyable code for a Studio setup: a TSX snippet that renders the
 * same thing with the registry component, and its install command.
 */

import {
  monoColors,
  snippetAttributes,
  sourceDefaults,
  stringAttribute,
} from "@/components/studio/look";
import type { MediaSourceId } from "@/components/studio/source-ids";
import type { StudioSource } from "@/components/studio/sources";
import { IMAGE_PRESETS } from "@/components/studio/state";
import type { Look, MediaSettings } from "@/components/studio/state";

export const REGISTRY_ORIGIN = "https://asciicn.dev";

export const installCommand = (source: StudioSource): string =>
  `npx shadcn@latest add ${REGISTRY_ORIGIN}/r/${source.registry}.json`;

const WEIGHT_CLASSES: Readonly<Record<number, string>> = {
  100: "font-thin",
  200: "font-extralight",
  300: "font-light",
  400: "font-normal",
  500: "font-medium",
  600: "font-semibold",
  700: "font-bold",
  800: "font-extrabold",
  900: "font-black",
};

/**
 * `AsciiText` draws real type in the page's font, so it takes a smaller
 * set of props: the glyphs, mono or duotone colour, and its font from
 * classes.
 */
const textAttributes = (look: Look, media: MediaSettings): string[] => {
  const attributes = [
    look.charset === "custom"
      ? stringAttribute("chars", look.chars)
      : stringAttribute("charset", look.charset),
  ];
  if (look.colorMode === "duotone") {
    attributes.push(`colorMode="duotone"`, stringAttribute("ramp", look.ramp));
  }
  const mono = look.colorMode === "mono" ? monoColors(look.ink) : null;
  if (mono) {
    attributes.push(stringAttribute("color", mono.ink));
  }
  if (look.dither !== "none") {
    attributes.push(stringAttribute("dither", look.dither));
  }
  attributes.push(
    `cell={${look.cell}}`,
    stringAttribute(
      "className",
      `font-${media.font} ${WEIGHT_CLASSES[media.weight] ?? "font-bold"}`
    )
  );
  return attributes;
};

/**
 * The defaults `AsciiImage` and `AsciiVideo` really use (see their prop
 * destructuring), which differ from the Studio's: the Studio previews media
 * at cell 9 with auto levels on, so the snippet has to spell those out.
 */
const MEDIA_COMPONENT_DEFAULTS = {
  image: { autoLevels: true, cell: 10 },
  video: { autoLevels: false, cell: 10 },
  webcam: { autoLevels: false, cell: 10 },
} as const satisfies Record<
  Exclude<MediaSourceId, "text">,
  { autoLevels: boolean; cell: number }
>;

type MediaComponentId = keyof typeof MEDIA_COMPONENT_DEFAULTS;

const isMediaComponent = (id: string): id is MediaComponentId =>
  Object.hasOwn(MEDIA_COMPONENT_DEFAULTS, id);

const levelsAttribute = (id: MediaComponentId, levels: boolean) => {
  if (levels === MEDIA_COMPONENT_DEFAULTS[id].autoLevels) {
    return [];
  }
  return [levels ? "autoLevels" : "autoLevels={false}"];
};

/** Media sources need the thing they sample. Uploads get a placeholder path. */
const mediaAttributes = (
  source: StudioSource,
  media: MediaSettings,
  { uploaded }: { uploaded: boolean }
): string[] => {
  switch (source.id) {
    case "image": {
      const preset = IMAGE_PRESETS.find((item) => item.id === media.image);
      return [
        stringAttribute(
          "src",
          uploaded || !preset ? "/your-image.jpg" : preset.src
        ),
        `alt="Describe the image"`,
        ...levelsAttribute("image", media.levels),
      ];
    }
    case "video": {
      return [
        stringAttribute(
          "src",
          uploaded || media.video === "" ? "/your-video.mp4" : media.video
        ),
        ...levelsAttribute("video", media.levels),
      ];
    }
    case "webcam": {
      return ["webcam", ...levelsAttribute("webcam", media.levels)];
    }
    default: {
      return [];
    }
  }
};

const element = (name: string, attributes: readonly string[]) => {
  const inline = `<${name}${attributes.map((item) => ` ${item}`).join("")} />`;
  if (inline.length <= 76) {
    return inline;
  }
  return [`<${name}`, ...attributes.map((item) => `  ${item}`), "/>"].join(
    "\n"
  );
};

/** A complete, pasteable TSX snippet for the current setup. */
export const jsxSnippet = (
  source: StudioSource,
  look: Look,
  media: MediaSettings,
  { uploaded = false }: { uploaded?: boolean } = {}
): string => {
  const head = `import { ${source.importName} } from "${source.importPath}";`;
  if (source.id === "text") {
    const attributes = textAttributes(look, media);
    const open = `<AsciiText ${attributes.join(" ")}>`;
    const body =
      open.length <= 76
        ? open
        : ["<AsciiText", ...attributes.map((item) => `  ${item}`), ">"].join(
            "\n"
          );
    const text = media.text.trim() === "" ? "asciicn" : media.text;
    return [
      head,
      "",
      body,
      `  {${JSON.stringify(text)}}`,
      "</AsciiText>",
      "",
    ].join("\n");
  }
  const seeded =
    source.kind === "field" && source.seeded && media.seed !== ""
      ? [stringAttribute("seed", media.seed)]
      : [];
  // Compare the cell with the component's own default, not the Studio's.
  const defaults = isMediaComponent(source.id)
    ? {
        ...sourceDefaults(source),
        cell: MEDIA_COMPONENT_DEFAULTS[source.id].cell,
      }
    : sourceDefaults(source);
  const attributes = [
    ...mediaAttributes(source, media, { uploaded }),
    ...seeded,
    ...snippetAttributes(look, defaults, {
      media: source.kind === "media",
    }),
    `className="h-96 w-full"`,
  ];
  return [head, "", element(source.importName, attributes), ""].join("\n");
};
