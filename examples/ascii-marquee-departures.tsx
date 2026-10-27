import { AsciiMarquee } from "@/components/asciicn/ascii-marquee";

const DEPARTURES = [
  "08:45  BA117   NEW YORK JFK   GATE B32  BOARDING",
  "09:10  AF1381  PARIS CDG      GATE A04  ON TIME",
  "09:25  NH212   TOKYO HND      GATE C11  DELAYED 40M",
  "09:40  QF2     SYDNEY         GATE B07  ON TIME",
] as const;

const ARRIVALS = [
  "08:52  EK29    DUBAI          LANDED",
  "09:05  LA8084  SAO PAULO      EXPECTED 09:18",
  "09:30  CX251   HONG KONG      ON TIME",
] as const;

export default function AsciiMarqueeDepartures() {
  return (
    <div className="w-full max-w-3xl text-[var(--ascii-color-orange)]">
      <AsciiMarquee
        items={DEPARTURES}
        secondRow={ARRIVALS}
        label="DEPARTURES"
        status="ARRIVALS ▼"
        frame="double"
        frameColor="orange"
        separator="■"
        speed={10}
        cell={20}
      />
    </div>
  );
}
