import { CHARSET_NAMES, INTERACTIONS } from "@/lib/ascii";
import { segmented, select } from "@/lib/preview-controls";

// Knobs for the interaction demo, shared by the page and the demo.

export const interaction = segmented({
  default: "repel",
  id: "interaction",
  label: "Interaction",
  options: INTERACTIONS,
});

export const charset = select({
  default: "dense",
  id: "charset",
  label: "Charset",
  options: CHARSET_NAMES,
});

export const controls = [interaction, charset];
