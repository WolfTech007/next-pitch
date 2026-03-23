"use client";

import type { ReactNode } from "react";

export type GameLiveHeaderProps = {
  awayName: string;
  homeName: string;
  awayAbbr: string;
  homeAbbr: string;
  scoreAway: number;
  scoreHome: number;
  halfLabel: string;
  inning: number;
  outs: number;
  balls: number;
  strikes: number;
  pitcherName: string;
  batterName: string;
  pitcherId: number | null;
  batterId: number | null;
  onFirst: boolean;
  onSecond: boolean;
  onThird: boolean;
  /** Demo / feed status line — rendered below the main bar inside the same card */
  footer?: ReactNode;
};

function mlbHeadshotUrl(personId: number): string {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/w_214,h_214,q_auto:best/v1/people/${personId}/headshot/silo/current`;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.[0] ?? "";
    const b = parts[parts.length - 1]?.[0] ?? "";
    return (a + b).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "—";
}

function BaseDiamond({
  onFirst,
  onSecond,
  onThird,
}: {
  onFirst: boolean;
  onSecond: boolean;
  onThird: boolean;
}) {
  const occupied = "rgb(245 158 11)";
  const empty = "rgb(39 39 42 / 0.35)";
  const stroke = "rgb(82 82 91)";
  return (
    <svg
      viewBox="0 0 44 44"
      className="h-11 w-11 shrink-0"
      role="img"
      aria-label={`Bases: first ${onFirst ? "occupied" : "empty"}, second ${onSecond ? "occupied" : "empty"}, third ${onThird ? "occupied" : "empty"}`}
    >
      <rect
        x="18"
        y="4"
        width="8"
        height="8"
        rx="1.2"
        fill={onSecond ? occupied : empty}
        strokeWidth="1.25"
        stroke={stroke}
      />
      <rect
        x="4"
        y="18"
        width="8"
        height="8"
        rx="1.2"
        fill={onThird ? occupied : empty}
        strokeWidth="1.25"
        stroke={stroke}
      />
      <rect
        x="32"
        y="18"
        width="8"
        height="8"
        rx="1.2"
        fill={onFirst ? occupied : empty}
        strokeWidth="1.25"
        stroke={stroke}
      />
      <path
        d="M18 36 L22 32 L26 36 Z"
        fill="none"
        strokeWidth="1.25"
        stroke={stroke}
      />
    </svg>
  );
}

function OutsDots({ outs }: { outs: number }) {
  const o = Math.min(2, Math.max(0, outs));
  return (
    <div className="flex items-center gap-1" aria-label={`${outs} out${outs === 1 ? "" : "s"}`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full border border-zinc-600 ${
            i < o ? "bg-zinc-200" : "bg-zinc-900/80"
          }`}
        />
      ))}
    </div>
  );
}

function PlayerChip({
  role,
  name,
  personId,
}: {
  role: string;
  name: string;
  personId: number | null;
}) {
  const initials = initialsFromName(name);

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-zinc-800/90 bg-zinc-950/50 px-3 py-2.5 ring-1 ring-zinc-800/40">
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-zinc-700/80 bg-zinc-800">
        {personId != null ? (
          // eslint-disable-next-line @next/next/no-img-element -- MLB CDN headshots
          <img
            src={mlbHeadshotUrl(personId)}
            alt=""
            width={44}
            height={44}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-[11px] font-bold tracking-tight text-zinc-400"
            aria-hidden
          >
            {initials}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{role}</p>
        <p className="mt-0.5 truncate text-sm font-semibold leading-tight text-zinc-100">{name}</p>
      </div>
    </div>
  );
}

/**
 * Premium live-game command bar: matchup + score (left), count + bases (center), pitcher / batter (right).
 */
export function GameLiveHeader(props: GameLiveHeaderProps) {
  const {
    awayName,
    homeName,
    awayAbbr,
    homeAbbr,
    scoreAway,
    scoreHome,
    halfLabel,
    inning,
    outs,
    balls,
    strikes,
    pitcherName,
    batterName,
    pitcherId,
    batterId,
    onFirst,
    onSecond,
    onThird,
    footer,
  } = props;

  const outsLabel = outs === 1 ? "1 OUT" : `${outs} OUTS`;

  return (
    <header className="mb-6 overflow-hidden rounded-2xl border border-zinc-800/90 bg-gradient-to-br from-zinc-900/95 via-zinc-950 to-black shadow-xl ring-1 ring-zinc-800/50">
      <div className="grid grid-cols-1 gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_auto_minmax(0,1.15fr)] lg:items-center lg:gap-8 lg:px-8 lg:py-6">
        {/* Left — game / score */}
        <div className="min-w-0 lg:pr-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Live game
          </p>
          <p className="mt-1 text-lg font-semibold tracking-tight text-zinc-200 sm:text-xl">
            {awayName} <span className="text-zinc-600">@</span> {homeName}
          </p>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums tracking-tight text-white sm:text-4xl">
            <span className="text-zinc-400">{awayAbbr}</span>{" "}
            <span className="text-white">{scoreAway}</span>
            <span className="mx-2 text-zinc-600">—</span>
            <span className="text-zinc-400">{homeAbbr}</span>{" "}
            <span className="text-white">{scoreHome}</span>
          </p>
          <p className="mt-2 font-mono text-sm font-semibold text-zinc-500">
            {halfLabel} {inning}
            <span className="mx-2 text-zinc-700">·</span>
            <span className="font-medium text-zinc-500">{outsLabel}</span>
          </p>
        </div>

        {/* Center — count + bases */}
        <div className="flex flex-col items-center justify-center border-y border-zinc-800/60 py-5 lg:border-x lg:border-y-0 lg:px-10 lg:py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-500/90">Count</p>
          <p className="mt-1 font-mono text-4xl font-bold tabular-nums text-amber-50 sm:text-5xl sm:leading-none">
            {balls}
            <span className="text-amber-500/50">–</span>
            {strikes}
          </p>
          <div className="mt-4 flex flex-col items-center gap-3">
            <BaseDiamond onFirst={onFirst} onSecond={onSecond} onThird={onThird} />
            <div className="flex items-center gap-4 text-[11px] tabular-nums text-zinc-500">
              <span>
                <span className="text-zinc-600">B</span> {balls}
              </span>
              <span className="text-zinc-800">|</span>
              <span>
                <span className="text-zinc-600">S</span> {strikes}
              </span>
              <span className="text-zinc-800">|</span>
              <span className="flex items-center gap-1.5">
                <span className="text-zinc-600">O</span>
                <OutsDots outs={outs} />
              </span>
            </div>
          </div>
        </div>

        {/* Right — pitcher / batter */}
        <div className="flex min-w-0 flex-col gap-2.5 lg:pl-2">
          <PlayerChip role="Pitcher" name={pitcherName} personId={pitcherId} />
          <PlayerChip role="Batter" name={batterName} personId={batterId} />
        </div>
      </div>

      {footer ? (
        <div className="border-t border-zinc-800/80 bg-black/25 px-4 py-3 sm:px-8">{footer}</div>
      ) : null}
    </header>
  );
}
