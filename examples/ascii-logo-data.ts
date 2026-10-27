/** A sample logo and its width over height, so space is kept before it loads. */
export interface SampleLogo {
  readonly alt: string;
  readonly ratio: number;
  readonly src: string;
}

// The fictional brands in public/examples/logos.
export const LOGOS = [
  { alt: "Halcyra", ratio: 163 / 40, src: "/examples/logos/halcyra.svg" },
  { alt: "Quillwork", ratio: 196 / 40, src: "/examples/logos/quillwork.svg" },
  { alt: "Orbitline", ratio: 166 / 40, src: "/examples/logos/orbitline.svg" },
  { alt: "Ferrovane", ratio: 197 / 40, src: "/examples/logos/ferrovane.svg" },
  { alt: "Lumenade", ratio: 203 / 40, src: "/examples/logos/lumenade.svg" },
  { alt: "Northpine", ratio: 246 / 40, src: "/examples/logos/northpine.svg" },
  { alt: "Vantor", ratio: 152 / 40, src: "/examples/logos/vantor.svg" },
  { alt: "Cobaltic", ratio: 166 / 40, src: "/examples/logos/cobaltic.svg" },
] as const satisfies readonly SampleLogo[];
