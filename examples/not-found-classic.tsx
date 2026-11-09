import { NotFound } from "@/components/asciicn/not-found";
import { Button } from "@/components/ui/button";

export default function NotFoundClassic() {
  return (
    <NotFound
      charset="standard"
      cell={12}
      titleAs="h3"
      title="Page not found"
      description="The classic ramp: the sand thins from @ to . at its edges."
      path="/docs/fields/sand"
      actions={
        <Button size="sm" variant="outline">
          Back to docs
        </Button>
      }
    />
  );
}
