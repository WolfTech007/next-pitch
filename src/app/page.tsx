import Link from "next/link";
import { Header } from "@/components/Header";
import { LiveGameScoreboardCard } from "@/components/LiveGameScoreboardCard";
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
  try {
    const date = getEasternDateString();
    const cards = await loadHomeGameCardsForDate(date).catch(
      (): HomeGameCardViewModel[] => [],
    );
    return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-blue">
            Prototype
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">Live MLB — Next Pitch</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Pick up to three buckets for the upcoming pitch, see a simple price, submit
            with fake money, then resolve after the next pitch (or use demo resolve).
            Scores below pull from MLB&apos;s public API (linescore, boxscore, broadcast
            listings).
          </p>
          <p className="mt-3 max-w-2xl text-sm text-zinc-500">
            Each person needs an account so balances and bet history stay separate.{" "}
            <Link href="/register" className="text-accent-blue hover:underline">
              Create account
            </Link>{" "}
            or{" "}
            <Link href="/login" className="text-accent-blue hover:underline">
              sign in
            </Link>{" "}
            to open a game and place bets.
          </p>
        </div>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">
            Games ({date})
          </h2>
          {cards.length === 0 ? (
            <p className="text-sm text-zinc-500">No games found.</p>
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
          <p className="text-red-400">Error: {msg}</p>
          {stack && <pre className="mt-4 overflow-auto text-xs text-zinc-500">{stack}</pre>}
        </main>
      </>
    );
  }
}
