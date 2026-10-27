import { AsciiBox } from "@/components/asciicn/ascii-box";
import { AsciiButton } from "@/components/asciicn/ascii-button";

export default function AsciiBoxDialog() {
  return (
    <AsciiBox
      role="alertdialog"
      aria-describedby="ascii-box-dialog-body"
      title="Delete branch?"
      labelAlign="center"
      frame="double"
      shadow="medium"
      color="red"
      filled
      padding={2}
      className="max-w-md"
    >
      <p
        id="ascii-box-dialog-body"
        className="text-sm text-balance text-muted-foreground"
      >
        <code className="font-mono text-foreground">feat/glyph-atlas</code> has
        14 commits that are not on main. They will be gone for good.
      </p>
      <div className="mt-[var(--box-ch)] flex justify-end gap-4">
        <AsciiButton variant="ghost" size="sm" color="grey">
          Keep it
        </AsciiButton>
        <AsciiButton size="sm" color="red" frame="heavy">
          Delete
        </AsciiButton>
      </div>
    </AsciiBox>
  );
}
