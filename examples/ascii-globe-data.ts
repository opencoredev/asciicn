import type {
  GlobeArc,
  GlobeMarker,
  LatLon,
} from "@/components/asciicn/ascii-globe";

// Sample places for the globe demos, as [lat, lon] in degrees.
export const SAN_FRANCISCO: LatLon = [37.77, -122.42];
export const NEW_YORK: LatLon = [40.71, -74.01];
export const SAO_PAULO: LatLon = [-23.55, -46.63];
export const LONDON: LatLon = [51.51, -0.13];
export const LAGOS: LatLon = [6.52, 3.38];
export const SINGAPORE: LatLon = [1.35, 103.82];
export const TOKYO: LatLon = [35.68, 139.69];
export const SYDNEY: LatLon = [-33.87, 151.21];

export const REGIONS: readonly GlobeMarker[] = [
  SAN_FRANCISCO,
  NEW_YORK,
  SAO_PAULO,
  LONDON,
  LAGOS,
  SINGAPORE,
  TOKYO,
  SYDNEY,
].map((at) => ({ at }));

export const LINKS: readonly GlobeArc[] = [
  { from: SAN_FRANCISCO, to: LONDON },
  { from: NEW_YORK, to: SAO_PAULO },
  { from: LONDON, to: SINGAPORE },
  { from: SINGAPORE, to: SYDNEY },
  { from: TOKYO, to: SAN_FRANCISCO },
  { from: LONDON, to: LAGOS },
];
