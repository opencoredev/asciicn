import { Miami } from "@/components/asciicn/miami";

// The neon turned down: the hotels keep their pastel walls and lit windows,
// and the bay loses most of its coloured streaks.
export default function MiamiLowNeon() {
  return (
    <div className="relative isolate h-96 w-full max-w-2xl overflow-hidden rounded-xl">
      <Miami neon={0.25} className="absolute inset-0" />
    </div>
  );
}
