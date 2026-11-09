import { RedwoodLight } from "@/components/asciicn/redwood-light";

// The same forest read by tone alone, through the sodium ramp: an old photograph.
export default function RedwoodLightSepia() {
  return (
    <div className="relative isolate h-96 w-full max-w-2xl overflow-hidden rounded-xl">
      <RedwoodLight
        colorMode="duotone"
        ramp="sodium"
        mist={false}
        className="absolute inset-0"
      />
    </div>
  );
}
