"use client";

import { useEffect, useState } from "react";

export type PitchReaction = {
  type: "win" | "loss" | "neutral";
  netAmount: number;
  /** Monotonic timestamp to re-trigger animation on new pitch. */
  key: number;
};

type Props = {
  reaction: PitchReaction | null;
};

/**
 * Full-viewport flash + floating money label that fires when a pitch resolves.
 * Self-cleans: renders nothing once the animation finishes.
 */
export function PitchResultReaction({ reaction }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!reaction) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 4200);
    return () => clearTimeout(t);
  }, [reaction]);

  if (!reaction || !visible) return null;

  const isWin = reaction.type === "win";
  const isLoss = reaction.type === "loss";

  const sign = isWin ? "+" : isLoss ? "−" : "";
  const labelColor = isWin
    ? "text-np-success"
    : isLoss
      ? "text-np-danger"
      : "text-white/80";
  const glowColor = isWin
    ? "drop-shadow(0 0 18px rgba(34,197,94,0.7)) drop-shadow(0 0 40px rgba(34,197,94,0.3))"
    : isLoss
      ? "drop-shadow(0 0 18px rgba(239,68,68,0.7)) drop-shadow(0 0 40px rgba(239,68,68,0.3))"
      : "drop-shadow(0 0 12px rgba(255,255,255,0.4))";

  return (
    <>
      {/* Floating money label */}
      <div
        key={`money-${reaction.key}`}
        className="pointer-events-none fixed inset-0 z-[101] flex items-center justify-center"
      >
        <span
          className={`animate-np-money-pop font-mono text-4xl font-black tracking-tight ${labelColor}`}
          style={{ filter: glowColor }}
        >
          {sign}${Math.abs(reaction.netAmount).toFixed(2)}
        </span>
      </div>
    </>
  );
}
