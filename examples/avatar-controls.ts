import { ASCII_COLOR_NAMES } from "@/lib/ascii";
import { color, segmented, select, toggle } from "@/lib/preview-controls";

// Knobs for the avatar's main demo, shared by the page and the demo.

export const source = segmented({
  default: "initials",
  id: "source",
  label: "Source",
  options: ["initials", "photo"],
});

export const name = select({
  default: "Ada Lovelace",
  id: "name",
  label: "Name",
  options: [
    "Ada Lovelace",
    "grace@navy.mil",
    "Linus",
    "deploy-bot",
    "Margaret Hamilton",
  ],
});

export const charset = select({
  default: "braille",
  id: "charset",
  label: "Charset",
  options: ["braille", "quadrants", "blocks", "standard", "dense", "dots"],
});

export const fromName = toggle({
  default: true,
  id: "from-name",
  label: "Tint from name",
});

export const tint = color({
  default: "blue",
  id: "color",
  label: "Tint",
  options: ASCII_COLOR_NAMES,
});

export const status = select({
  default: "online",
  id: "status",
  label: "Status",
  options: ["none", "online", "away", "busy", "offline"],
});

export const shape = segmented({
  default: "circle",
  id: "shape",
  label: "Shape",
  options: ["circle", "square"],
});

/** Display order of the tray. */
export const controls = [source, name, charset, fromName, tint, status, shape];
