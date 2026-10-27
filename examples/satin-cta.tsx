import { Satin } from "@/components/asciicn/satin";

export default function SatinCta() {
  return (
    <section className="relative isolate flex size-full flex-col items-center justify-center gap-4 px-6 text-center">
      <Satin seed="sunday" intensity={0.6} className="absolute inset-0 -z-10" />
      <h3 className="max-w-md text-3xl font-medium tracking-[-0.03em] text-balance">
        The spring edit is live
      </h3>
      <a
        href="#satin-cta"
        className="bg-primary text-primary-foreground focus-visible:ring-ring rounded-lg px-4 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        Shop the collection
      </a>
    </section>
  );
}
