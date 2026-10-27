import { useState } from "react";

import type { StageSettings } from "@/components/home/looks";
import { findSource, STAGE_SOURCES } from "@/components/home/sources";
import type { StageSource } from "@/components/home/sources";
import type { SettingsPatch } from "@/components/home/stage-controls";

/**
 * Settings for one stage, with the source looked up. Unknown ids fall back
 * to the first source, so a stale link still draws something.
 */
export const useStageSettings = (
  initial: StageSettings,
  sources: readonly StageSource[] = STAGE_SOURCES
) => {
  const [settings, setSettings] = useState(initial);
  const source =
    findSource(settings.sourceId, sources) ?? sources[0] ?? STAGE_SOURCES[0];
  const update = (patch: SettingsPatch) =>
    setSettings((current) => ({ ...current, ...patch }));
  return { settings, source, update } as const;
};
