import { parseStudioParams } from "@/components/studio/state";
import { Studio } from "@/components/studio/studio";
import { ROUTES } from "@/constants/routes";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  description:
    "Turn shaders, scenes, photos, video, your webcam or a line of text into live ASCII. Tune every engine setting, then copy the TSX or export .txt, .ans, .svg, .png or .webm.",
  ogImage: ROUTES.OG,
  path: ROUTES.STUDIO,
  title: "ASCII Studio",
});

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Parsed on the server so a shared link renders its setup on first paint.
  const initial = parseStudioParams(await searchParams);
  return <Studio initial={initial} />;
}
