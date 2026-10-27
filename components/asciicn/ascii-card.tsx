"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import { AsciiBox } from "@/components/asciicn/ascii-box";
import type {
  AsciiBoxFrame,
  AsciiBoxProps,
} from "@/components/asciicn/ascii-box";
import { AsciiGlow } from "@/components/asciicn/ascii-glow";
import type { GlowPosition } from "@/components/asciicn/ascii-glow";
import type { AsciiColor, CharsetName } from "@/lib/ascii";
import { cn } from "@/lib/utils";

export interface AsciiCardProps extends Omit<AsciiBoxProps, "backdrop"> {
  /** Set into the top border, as in `┌─ Title ─────┐`. Also names the card for screen readers. */
  title?: ReactNode;
  /** Plain text under the title, in the muted colour. */
  description?: ReactNode;
  /** Where a glyph glow lights the card from, or `"none"`. Default `"none"`. */
  glow?: GlowPosition | "none";
  /** Glyphs the glow is drawn with. Default `"standard"`. */
  glowCharset?: CharsetName;
  /** Glow colour. Default: the frame's `color`. */
  glowColor?: AsciiColor;
  /** For clickable cards: on hover and focus the frame turns heavy and the glow brightens. Default `false`. */
  interactive?: boolean;
  /** The frame used while an interactive card is hovered or focused. Default `"heavy"`. */
  activeFrame?: AsciiBoxFrame;
}

/**
 * A card framed in box-drawing glyphs, with its title set into the top
 * border and an optional glyph glow lighting it from an edge or a corner.
 * Built on `AsciiBox`, so it snaps to the cell grid like every frame.
 */
export const AsciiCard = ({
  title,
  description,
  glow = "none",
  glowCharset = "standard",
  glowColor,
  interactive = false,
  frame = "light",
  activeFrame = "heavy",
  color = "ink",
  padding = 1,
  className,
  children,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  ...props
}: AsciiCardProps) => {
  const [active, setActive] = useState(false);
  const lit = interactive && active;
  return (
    <AsciiBox
      data-slot="ascii-card"
      data-active={lit ? "" : undefined}
      title={title}
      frame={lit ? activeFrame : frame}
      color={color}
      padding={padding}
      className={cn("w-full", className)}
      backdrop={
        glow === "none" ? undefined : (
          <AsciiGlow
            position={glow}
            charset={glowCharset}
            color={glowColor ?? color}
            intensity={lit ? 0.95 : 0.7}
            radius={lit ? 0.85 : 0.7}
            className="absolute inset-0"
          />
        )
      }
      onPointerEnter={(event) => {
        setActive(true);
        onPointerEnter?.(event);
      }}
      onPointerLeave={(event) => {
        setActive(false);
        onPointerLeave?.(event);
      }}
      onFocus={(event) => {
        setActive(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        // Focus moving between links inside the card keeps it lit.
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setActive(false);
        }
        onBlur?.(event);
      }}
      {...props}
    >
      {description ? (
        <p className="mb-[var(--box-ch)] text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {children}
    </AsciiBox>
  );
};
