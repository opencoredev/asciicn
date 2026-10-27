import { NotFound } from "@/components/asciicn/not-found";
import { Button } from "@/components/ui/button";

export default function NotFoundError() {
  return (
    <NotFound
      titleAs="h2"
      code="500"
      color="red"
      glyph="▓"
      title="Something went wrong"
      description="We couldn't load this page. Try again in a moment."
      path="/dashboard/usage"
      detail="error 500 · ref 7f3a-e21c"
      actions={
        <Button size="sm" variant="outline">
          Try again
        </Button>
      }
    />
  );
}
