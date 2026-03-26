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
  bettingWindow?: {
    startMs: number | null;
    durationMs?: number;
  };
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
  const occupied = "#00CFFF";
  const empty = "rgba(255,255,255,0.08)";
  const stroke = "rgba(59, 130, 246, 0.45)";
  return (
    <svg
      viewBox="0 0 44 44"
      className="h-11 w-11 shrink-0 drop-shadow-[0_0_12px_rgba(37,99,255,0.25)]"
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
      <path d="M18 36 L22 32 L26 36 Z" fill="none" strokeWidth="1.25" stroke={stroke} />
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
          className={`h-2 w-2 rounded-full border border-white/20 ${
            i < o ? "bg-np-text shadow-[0_0_8px_rgba(255,255,255,0.35)]" : "bg-white/10"
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
    <div className="flex min-w-0 items-center gap-2 rounded-np-control border border-white/[0.08] bg-np-panel/80 px-2.5 py-1.5 shadow-np-card backdrop-blur-md">
      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-np-blue/30 bg-np-card">
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
            className="flex h-full w-full items-center justify-center text-[11px] font-bold tracking-tight text-white/50"
            aria-hidden
          >
            {initials}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/45">{role}</p>
        <p className="truncate text-xs font-semibold leading-tight text-np-text">{name}</p>
      </div>
    </div>
  );
}

/**
 * Live matchup bar — scoreboard + count + personnel in a command-center card.
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
    bettingWindow,
    footer,
  } = props;

  const outsLabel = outs === 1 ? "1 OUT" : `${outs} OUTS`;
  const durationMs = bettingWindow?.durationMs ?? 15_000;
  const now = Date.now();
  const remainingMs =
    bettingWindow?.startMs == null
      ? durationMs
      : Math.max(0, durationMs - (now - bettingWindow.startMs));
  const pct = Math.max(0, Math.min(1, remainingMs / durationMs));
  const seconds = Math.ceil(remainingMs / 1000);

  return (
    <header className="np-card np-card-interactive col-span-12 overflow-hidden border border-white/[0.06] shadow-np-card">
      <div className="grid grid-cols-1 gap-2 px-4 py-1.5 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_auto_minmax(0,1.15fr)] lg:items-center lg:gap-5 lg:py-2">
        <div className="min-w-0 lg:pr-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/40">
              Live game
            </p>
            <span className="rounded-full border border-np-success/35 bg-np-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-np-success">
              In play
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold tracking-tight text-np-text sm:text-base">
            {awayName} <span className="text-white/35">@</span> {homeName}
          </p>
          <p className="mt-1.5 font-mono text-[26px] font-bold tabular-nums tracking-tight text-np-text sm:text-[30px]">
            <span className="text-white/50">{awayAbbr}</span>{" "}
            <span className="text-np-text">{scoreAway}</span>
            <span className="mx-2 text-white/25">—</span>
            <span className="text-white/50">{homeAbbr}</span>{" "}
            <span className="text-np-text">{scoreHome}</span>
          </p>
          <p className="mt-1 font-mono text-[11px] font-medium text-white/50">
            {halfLabel} {inning}
            <span className="mx-2 text-white/15">·</span>
            <span>{outsLabel}</span>
          </p>
        </div>

        <div className="flex flex-col items-center justify-center border-y border-white/[0.06] py-2 lg:border-x lg:border-y-0 lg:px-6 lg:py-0.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-np-cyan/90">Count</p>
          <p className="mt-0.5 bg-gradient-to-b from-white via-np-text to-white/70 bg-clip-text font-mono text-[40px] font-bold tabular-nums text-transparent sm:text-[44px] sm:leading-none">
            {balls}
            <span className="text-np-blue/40">–</span>
            {strikes}
          </p>
          <div className="mt-1.5 flex flex-col items-center gap-1">
            <BaseDiamond onFirst={onFirst} onSecond={onSecond} onThird={onThird} />
            <div className="flex items-center gap-4 text-[11px] tabular-nums text-white/45">
              <span>
                <span className="text-white/30">B</span> {balls}
              </span>
              <span className="text-white/10">|</span>
              <span>
                <span className="text-white/30">S</span> {strikes}
              </span>
              <span className="text-white/10">|</span>
              <span className="flex items-center gap-1.5">
                <span className="text-white/30">O</span>
                <OutsDots outs={outs} />
              </span>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5 lg:pl-1">
          <PlayerChip role="Pitcher" name={pitcherName} personId={pitcherId} />
          <PlayerChip role="Batter" name={batterName} personId={batterId} />
        </div>
      </div>

      {bettingWindow ? (
        <div className="border-t border-white/[0.06] bg-black/25 px-4 py-1 sm:px-6">
          <div className="mb-1 flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
              Betting window
            </p>
            <p className="font-mono text-[11px] font-semibold text-white/55">
              {seconds}s
            </p>
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.05]">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-np-blue-bright via-np-cyan to-np-blue shadow-[0_0_18px_rgba(0,207,255,0.25)] transition-[width] duration-100 ease-linear"
              style={{ width: `${Math.max(2, pct * 100)}%` }}
            />
          </div>
          {footer ? <div className="mt-2">{footer}</div> : null}
        </div>
      ) : null}
    </header>
  );
}
