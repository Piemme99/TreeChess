import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../../../stores/authStore';
import { playedGamesFixture } from '../fixtures/playedGames';
import { REPLAY_START } from '../replay/replaySetup';
import { PageHeader } from '../workshop/PageHeader';
import { COLOURS, raised, SPRING, tile } from '../workshop/theme';

const IMPORTED = playedGamesFixture.filter((game) => game.playedAt < REPLAY_START);
// L'import est simulé : le temps de le voir avancer, pas plus.
const DURATION = 1600;

/** Première visite (README, « Path by use », écran 1). POC : l'historique figé de Piemme78 tient lieu d'import. */
export function ImportScreen({ onDone }: { onDone: () => void }) {
  const user = useAuthStore((state) => state.user);
  const [name, setName] = useState(user?.lichessUsername ?? '');
  const [read, setRead] = useState<number | null>(null);

  useEffect(() => {
    if (read === null) return;
    if (read >= IMPORTED.length) {
      const timer = window.setTimeout(onDone, 500);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => setRead(Math.min(IMPORTED.length, read + Math.ceil(IMPORTED.length / (DURATION / 50)))), 50);
    return () => window.clearTimeout(timer);
  }, [read, onDone]);

  const white = IMPORTED.slice(0, read ?? 0).filter((game) => game.side === 'w').length;
  return (
    <>
      <PageHeader />
      <main className="mx-auto flex max-w-[30rem] flex-col gap-4 px-4 pt-10">
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={SPRING} className="flex flex-col gap-4 rounded-3xl p-6" style={raised(false)}>
          <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em]">Build your repertoire from your games</h1>
          <p className="text-[15px]" style={{ color: COLOURS.leafSoft }}>
            Your moves played at least one time in five become your repertoire. Then we show where you lose points.
          </p>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (read === null) setRead(0);
            }}
          >
            <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
              Lichess username
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Piemme78"
                disabled={read !== null}
                className="min-h-12 rounded-xl px-3 text-[16px] font-medium focus-visible:outline-2"
                style={tile(COLOURS.cream)}
              />
            </label>
            {read === null ? (
              <motion.button type="submit" whileTap={{ scale: 0.97 }} transition={SPRING} className="self-start rounded-full px-6 py-2.5 text-[16px] font-bold focus-visible:outline-2" style={raised(true)}>
                Import
              </motion.button>
            ) : (
              <span role="status" className="flex flex-col gap-2 text-[14px] font-semibold">
                <span className="h-2 overflow-hidden rounded-full" style={{ background: COLOURS.sand }}>
                  <motion.span className="block h-full rounded-full" style={{ background: COLOURS.leaf }} animate={{ width: `${(read / IMPORTED.length) * 100}%` }} transition={{ duration: 0.05 }} />
                </span>
                {read < IMPORTED.length
                  ? `${read.toLocaleString('en-GB')} games read · ${white.toLocaleString('en-GB')} as White, ${(read - white).toLocaleString('en-GB')} as Black`
                  : 'Building your repertoire…'}
              </span>
            )}
          </form>
          <p className="text-[12px]" style={{ color: COLOURS.leafSoft }}>
            Prototype: the games imported are Piemme78's, whatever the name.
          </p>
        </motion.section>
      </main>
    </>
  );
}
