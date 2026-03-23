import Link from "next/link";
import type { HomeGameCardViewModel } from "@/lib/homeGameCard";

function teamLogoUrl(teamId: number): string {
  return `https://www.mlbstatic.com/team-logos/${teamId}.svg`;
}

function teamLogoInitials(teamName: string): string {
  const parts = teamName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.[0] ?? "";
    const b = parts[parts.length - 1]?.[0] ?? "";
    return (a + b).toUpperCase();
  }
  return teamName.slice(0, 2).toUpperCase();
}

function headshotUrl(personId: number): string {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/w_214,h_214,q_auto:best/v1/people/${personId}/headshot/silo/current`;
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
  const fill = "currentColor";
  const empty = "none";
  const stroke = "currentColor";
  return (
    <svg
      viewBox="0 0 44 44"
      className="h-[3.25rem] w-[3.25rem] shrink-0 text-zinc-500"
      aria-hidden
    >
      {/* second — top */}
      <rect
        x="18"
        y="4"
        width="8"
        height="8"
        rx="1"
        fill={onSecond ? fill : empty}
        strokeWidth="1.5"
        stroke={stroke}
        className="text-zinc-500"
      />
      {/* third — left */}
      <rect
        x="4"
        y="18"
        width="8"
        height="8"
        rx="1"
        fill={onThird ? fill : empty}
        strokeWidth="1.5"
        stroke={stroke}
      />
      {/* first — right */}
      <rect
        x="32"
        y="18"
        width="8"
        height="8"
        rx="1"
        fill={onFirst ? fill : empty}
        strokeWidth="1.5"
        stroke={stroke}
      />
      {/* home */}
      <path
        d="M18 36 L22 32 L26 36 Z"
        fill={empty}
        strokeWidth="1.5"
        stroke={stroke}
      />
    </svg>
  );
}

function OutsDots({ outs }: { outs: number }) {
  const o = Math.min(2, Math.max(0, outs));
  return (
    <div className="flex items-center gap-0.5" aria-label={`${outs} outs`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full border border-zinc-500 ${
            i < o ? "bg-zinc-200" : "bg-transparent"
          }`}
        />
      ))}
    </div>
  );
}

export function LiveGameScoreboardCard({ card }: { card: HomeGameCardViewModel }) {
  const { away, home } = card;

  return (
    <Link
      href={card.href}
      className="group np-card np-card-interactive block overflow-hidden rounded-np-card border border-white/[0.06] shadow-np-card transition hover:border-np-blue/35"
    >
      {/* Header */}
      <div className="border-b border-white/[0.06] px-4 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-bold tracking-tight text-white">
            {card.inningLabel}
          </p>
          {card.statusHint ? (
            <p className="text-[10px] text-white/45">{card.statusHint}</p>
          ) : null}
        </div>
      </div>

      {/* Score + state */}
      <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-white/[0.06] px-4 py-3">
        <div className="min-w-0 space-y-2">
          <TeamRow
            name={away.name}
            teamId={away.teamId}
            runs={away.runs}
            hits={away.hits}
            errors={away.errors}
            record={away.record}
            emphasize={away.runs > home.runs}
          />
          <TeamRow
            name={home.name}
            teamId={home.teamId}
            runs={home.runs}
            hits={home.hits}
            errors={home.errors}
            record={home.record}
            emphasize={home.runs > away.runs}
          />
        </div>

        <div className="flex flex-col items-center gap-2 border-l border-white/[0.06] pl-3">
          <BaseDiamond
            onFirst={card.onFirst}
            onSecond={card.onSecond}
            onThird={card.onThird}
          />
          <OutsDots outs={card.outs} />
          <p className="font-mono text-sm font-semibold tabular-nums text-white">
            {card.balls} - {card.strikes}
          </p>
          <p className="text-[9px] uppercase tracking-wide text-white/40">count</p>
        </div>
      </div>

      {card.broadcast ? (
        <p className="border-b border-white/[0.06] px-4 py-1.5 text-[10px] text-white/45">
          Watch on: <span className="text-white/65">{card.broadcast}</span>
        </p>
      ) : null}

      {/* Matchup */}
      <div className="grid grid-cols-2 gap-px bg-white/[0.06]">
        <MatchupCell
          kicker={`Pitching ${card.pitching.teamAbbr}`}
          name={card.pitching.lastName}
          detail={card.pitching.detail}
          personId={card.pitching.personId}
        />
        <MatchupCell
          kicker={`At bat ${card.atBat.teamAbbr}`}
          name={card.atBat.lastName}
          detail={card.atBat.detail}
          personId={card.atBat.personId}
        />
      </div>

      {card.hideGamePkFooter ? (
        <p className="px-4 py-2 text-[10px] text-white/40 group-hover:text-white/55">
          Open game
        </p>
      ) : (
        <p className="px-4 py-2 text-[10px] text-white/40 group-hover:text-white/55">
          Open game · #{card.gamePk}
        </p>
      )}
    </Link>
  );
}

function TeamRow({
  name,
  teamId,
  runs,
  hits,
  errors,
  record,
  emphasize,
}: {
  name: string;
  teamId: number;
  runs: number;
  hits: number;
  errors: number;
  record: string;
  emphasize: boolean;
}) {
  const showPlaceholder = teamId <= 0;

  return (
    <div className="flex items-center gap-2">
      {showPlaceholder ? (
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-600 bg-zinc-800 text-[10px] font-bold text-zinc-300"
          aria-hidden
        >
          {teamLogoInitials(name)}
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- remote MLB SVG
        <img
          src={teamLogoUrl(teamId)}
          alt=""
          width={36}
          height={36}
          className="h-9 w-9 shrink-0 object-contain"
        />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-semibold ${
            emphasize ? "text-white" : "text-zinc-200"
          }`}
        >
          {name}
        </p>
        <p className="text-[10px] text-zinc-500">{record}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs tabular-nums">
        <div>
          <p className="text-[9px] uppercase text-zinc-500">R</p>
          <p className={emphasize ? "font-semibold text-white" : "text-zinc-300"}>{runs}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase text-zinc-500">H</p>
          <p className="text-zinc-300">{hits}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase text-zinc-500">E</p>
          <p className="text-zinc-300">{errors}</p>
        </div>
      </div>
    </div>
  );
}

function MatchupCell({
  kicker,
  name,
  detail,
  personId,
}: {
  kicker: string;
  name: string;
  detail: string;
  personId: number | null;
}) {
  return (
    <div className="bg-surface-card p-3">
      <p className="text-[9px] font-medium uppercase tracking-wide text-zinc-500">
        {kicker}
      </p>
      <div className="mt-2 flex gap-2">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-zinc-800">
          {personId != null ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote MLB headshots
            <img
              src={headshotUrl(personId)}
              alt=""
              width={48}
              height={48}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-600">
              —
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{name}</p>
          <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">{detail}</p>
        </div>
      </div>
    </div>
  );
}
