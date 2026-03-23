import { getSession } from "@/lib/auth/session";
import { resolveDemoModeForServerComponents } from "@/lib/demo-mode";
import { GameClient } from "./GameClient";

type PageProps = { params: Promise<{ gamePk: string }> };

/**
 * Game route — wraps client polling UI for the scoreboard + slip panel.
 */
export default async function GamePage(props: PageProps) {
  const { gamePk: raw } = await props.params;
  const gamePk = Number(raw);
  const { enabled: demoMode } = await resolveDemoModeForServerComponents(await getSession());

  return <GameClient gamePk={gamePk} demoMode={demoMode} />;
}
