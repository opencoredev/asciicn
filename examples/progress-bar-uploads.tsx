import { ProgressBar } from "@/components/asciicn/progress-bar";

export default function ProgressBarUploads() {
  return (
    <ul className="flex w-full max-w-md flex-col gap-5">
      <li>
        <ProgressBar
          label="hero-poster.png"
          value={100}
          valueText="Done"
          size="lg"
          color="green"
        />
      </li>
      <li>
        <ProgressBar
          label="product-tour.mp4"
          value={46.25}
          size="lg"
          color="purple"
        />
      </li>
      <li>
        <ProgressBar
          label="Transcoding product-tour.mp4"
          size="lg"
          color="purple"
          track="line"
        />
      </li>
    </ul>
  );
}
