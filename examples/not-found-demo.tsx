"use client";

import { NotFound } from "@/components/asciicn/not-found";
import { usePreviewValue } from "@/components/preview-controls";
import { Button } from "@/components/ui/button";
import * as knobs from "@/examples/not-found-controls";

const COPY = {
  "404": {
    description:
      "The page you asked for isn't here. It may have moved, or the link may be out of date.",
    path: "/docs/getting-startd",
    title: "Page not found",
  },
  "410": {
    description:
      "This page was removed on purpose. The guide that replaced it is in the docs.",
    path: "/blog/2019/launch-notes",
    title: "This page is gone",
  },
  "500": {
    description:
      "Something went wrong on our side. Try again in a moment; we have been told.",
    path: "/api/orders",
    title: "Something broke",
  },
} as const;

export default function NotFoundDemo() {
  const code = usePreviewValue(knobs.code);
  const copy = COPY[code];
  return (
    <NotFound
      code={code}
      titleAs="h2"
      title={copy.title}
      description={copy.description}
      path={copy.path}
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      accent={usePreviewValue(knobs.accent)}
      wind={usePreviewValue(knobs.wind)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      actions={
        <>
          <Button size="sm">Back home</Button>
          <Button size="sm" variant="outline">
            Browse components
          </Button>
        </>
      }
    />
  );
}
