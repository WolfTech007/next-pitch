import type { PitchType } from "@/lib/markets";

/** Tailwind class fragments for pitch-type accents (text + dot fill). */
export function pitchTypeStyles(t: PitchType): {
  text: string;
  fill: string;
  dot: string;
  ring: string;
} {
  switch (t) {
    case "Fastball":
      return {
        text: "text-sky-400",
        fill: "fill-sky-400",
        dot: "bg-sky-400",
        ring: "ring-sky-500/60",
      };
    case "Slider":
      return {
        text: "text-violet-400",
        fill: "fill-violet-400",
        dot: "bg-violet-400",
        ring: "ring-violet-500/60",
      };
    case "Curveball":
      return {
        text: "text-amber-400",
        fill: "fill-amber-400",
        dot: "bg-amber-400",
        ring: "ring-amber-500/60",
      };
    case "Changeup":
      return {
        text: "text-emerald-400",
        fill: "fill-emerald-400",
        dot: "bg-emerald-400",
        ring: "ring-emerald-500/60",
      };
    default:
      return {
        text: "text-zinc-400",
        fill: "fill-zinc-400",
        dot: "bg-zinc-400",
        ring: "ring-zinc-500/50",
      };
  }
}
