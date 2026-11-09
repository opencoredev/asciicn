import { NotFound } from "@/components/asciicn/not-found";
import { Button } from "@/components/ui/button";

export default function NotFoundError() {
  return (
    <NotFound
      code="500"
      titleAs="h3"
      title="Something broke"
      description="The server hit an error it could not recover from. Try again in a moment; we have been told."
      path="/api/orders"
      command="curl -f"
      message="(22) the server returned 500"
      accent="red"
      wind={1.4}
      actions={
        <>
          <Button size="sm">Try again</Button>
          <Button size="sm" variant="outline">
            Status page
          </Button>
        </>
      }
    />
  );
}
