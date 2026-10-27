import { FILL_TEXTURES, fillStyle } from "@/lib/ascii";

// Every fill texture as a CSS mask on a plain <div>: the dense edge at the
// bottom, thinning upwards. No canvas, renders on the server.
export default function EngineFills() {
  return (
    <div className="grid w-full grid-cols-2 gap-4 p-4 sm:grid-cols-4 lg:grid-cols-7">
      {FILL_TEXTURES.map((texture) => (
        <figure key={texture} className="flex flex-col gap-2">
          <div
            className="h-40 w-full rounded-sm"
            style={fillStyle(texture, { cell: 12, length: 12 })}
          />
          <figcaption className="text-muted-foreground font-mono text-xs">
            {texture}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
