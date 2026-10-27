import { AsciiButton } from "@/components/asciicn/ascii-button";
import { NotFound } from "@/components/asciicn/not-found";

export default function NotFoundError() {
  return (
    <NotFound
      titleAs="h2"
      code="500"
      color="red"
      title="Something went wrong"
      description="We could not load this page. Try again in a moment."
      detail="ref 7f3a-e21c · 14:02 UTC"
      actions={
        <AsciiButton color="red" fill="hatched" variant="outline">
          Try again
        </AsciiButton>
      }
      className="w-full"
    />
  );
}
