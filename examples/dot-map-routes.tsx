import { DotMap } from "@/components/asciicn/dot-map";
import { OFFICES, ROUTES } from "@/examples/dot-map-data";

const MARKERS = OFFICES.map(({ at }) => ({ at }));

export default function DotMapRoutes() {
  return (
    <div className="flex w-full justify-center px-4 py-8 sm:px-8">
      <DotMap
        markers={MARKERS}
        arcs={ROUTES}
        accent="orange"
        color="purple"
        ocean={0.12}
        halo={0}
        cell={8}
        animate={false}
        title="Shipping routes"
        className="max-w-2xl"
      />
    </div>
  );
}
