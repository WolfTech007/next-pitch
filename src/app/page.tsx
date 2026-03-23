import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { DemoModeToggle } from "@/components/DemoModeToggle";
import { Header } from "@/components/Header";
import { LiveGameScoreboardCard } from "@/components/LiveGameScoreboardCard";
import { readDemoModeFromCookies } from "@/lib/demo-mode";
import { buildDemoFallbackHomeCards } from "@/lib/demo-fallback-home-cards";
import { decorateDemoHomeCards } from "@/lib/demo-home-presentation";
import {
  type HomeGameCardViewModel,
  loadHomeGameCardsForDate,
} from "@/lib/homeGameCard";
import { getEasternDateString } from "@/lib/mlb";

export const dynamic = "force-dynamic";

/**
 * Home lists games with live MLB linescore-style cards (schedule + linescore + boxscore).
 */
export default async function HomePage() {
  noStore();
  try {
    const { enabled: demoMode, date: demoDate } = await readDemoModeFromCookies();
    const date =
      demoMode && demoDate && demoDate.length >= 8 ? demoDate : getEasternDateString();
    let cards = await loadHomeGameCardsForDate(date, {
      includeCompleted: demoMode,
    }).catch((): HomeGameCardViewModel[] => []);
    if (demoMode && cards.length === 0) {
      cards = buildDemoFallbackHomeCards();
    }
    if (demoMode && cards.length > 0) {
      cards = decorateDemoHomeCards(cards);
    }
    return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
        <div className="np-card np-card-interactive mb-10 rounded-np-card border border-white/[0.06] p-8 shadow-np-card">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] pb-6">
            <DemoModeToggle />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-np-cyan/90">
            Prototype
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-np-text lg:text-4xl">
            Live MLB — Next Pitch
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
            Pick up to three buckets for the upcoming pitch, see a simple price, submit
            with fake money, then resolve after the next pitch (or use demo resolve).
            Scores below pull from MLB&apos;s public API (linescore, boxscore, broadcast
            listings).
          </p>
          <p className="mt-4 max-w-2xl text-sm text-white/45">
            Each person needs an account so balances and bet history stay separate.{" "}
            <Link href="/register" className="font-medium text-np-blue-bright hover:underline">
              Create account
            </Link>{" "}
            or{" "}
            <Link href="/login" className="font-medium text-np-blue-bright hover:underline">
              sign in
            </Link>{" "}
            to open a game and place bets.
          </p>
        </div>

        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-white/45">
            Games ({date})
          </h2>
          {cards.length === 0 ? (
            <p className="text-sm text-white/45">No games found.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {cards.map((c) => (
                <li key={c.gamePk}>
                  <LiveGameScoreboardCard card={c} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    return (
      <>
        <Header />
        <main className="mx-auto max-w-5xl px-4 py-8">
          <p className="text-np-danger">Error: {msg}</p>
          {stack && <pre className="mt-4 overflow-auto text-xs text-white/45">{stack}</pre>}
        </main>
      </>
    );
  }
}
