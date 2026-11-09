import { AsciiReveal } from "@/components/asciicn/ascii-reveal";

const CARDS = [
  {
    alt: "Abraham Lincoln in 1863, facing the camera, in a dark coat and bow tie",
    direction: "up",
    name: "Abraham Lincoln",
    role: "1863",
    src: "/examples/lincoln.jpg",
  },
  {
    alt: "Astronaut Sally Ride in 1984, smiling, in a navy NASA shirt",
    direction: "radial",
    name: "Sally Ride",
    role: "1984",
    src: "/examples/ride.jpg",
  },
  {
    alt: "Buzz Aldrin standing on the Moon during Apollo 11",
    direction: "random",
    name: "Buzz Aldrin",
    role: "1969",
    src: "/examples/aldrin.jpg",
  },
] as const;

export default function AsciiRevealCards() {
  return (
    <div className="grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-3">
      {CARDS.map((card) => (
        <figure key={card.src} className="flex flex-col gap-2">
          <AsciiReveal
            src={card.src}
            alt={card.alt}
            trigger="hover"
            direction={card.direction}
            duration={1100}
            cell={8}
            ratio={4 / 5}
            className="w-full rounded-md"
          />
          <figcaption className="flex flex-wrap justify-between gap-x-2 font-mono text-xs">
            <span>{card.name}</span>
            <span className="text-muted-foreground">{card.role}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
