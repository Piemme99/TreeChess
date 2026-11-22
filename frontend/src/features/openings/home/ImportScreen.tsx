import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { lichessSignInUrl } from '../line/explorer';
import type { ImportState } from '../source/useGameSource';
import { PageHeader } from '../workshop/PageHeader';
import { COLOURS, raised, SPRING } from '../workshop/theme';

/** Sans compte Lichess (README, « Import », écran 1) : se connecter, ou essayer sur les parties d'un joueur exemple. */
export function SignInScreen({ onDemo }: { onDemo: () => void }) {
  // Lichess renvoie ici, avec ?error=…, une connexion refusée ou échouée.
  const [params] = useSearchParams();
  return (
    <Card title="Build your repertoire from your games">
      <p>Sign in with Lichess: we import your blitz, rapid and classical games, and keep your repertoire on your account.</p>
      {params.get('deleted') && (
        <p role="status" className="font-semibold" style={{ color: COLOURS.leaf }}>
          Your account and its data are deleted.
        </p>
      )}
      {params.get('error') && (
        <p role="alert" className="font-semibold" style={{ color: COLOURS.terracotta }}>
          The Lichess sign-in did not go through. Try again.
        </p>
      )}
      <a href={lichessSignInUrl()} className="self-start rounded-full px-6 py-2.5 text-[16px] font-bold focus-visible:outline-2" style={raised(true)}>
        Sign in with Lichess
      </a>
      <button type="button" onClick={onDemo} className="self-start py-1 text-[15px] font-semibold underline underline-offset-4 focus-visible:outline-2" style={{ color: COLOURS.leafSoft }}>
        Try it on a sample player
      </button>
    </Card>
  );
}

/** Compte Lichess connecté (écrans 2 et 3) : lancer l'import, puis le voir avancer ; le serveur continue sans la page. */
export function ImportScreen({ username, state, onImport }: { username: string; state: ImportState; onImport: () => void }) {
  const running = state.status === 'running';
  return (
    <Card title={running ? 'Importing your games…' : 'Import your games'}>
      {running ? (
        <span role="status" className="flex flex-col gap-2 font-semibold" style={{ color: COLOURS.leaf }}>
          <span className="h-2 overflow-hidden rounded-full" style={{ background: COLOURS.sand }}>
            <motion.span className="block h-full w-1/3 rounded-full" style={{ background: COLOURS.leaf }} animate={{ x: ['-100%', '300%'] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }} />
          </span>
          {state.imported.toLocaleString('en-GB')} games so far. You can leave this page: the import goes on.
        </span>
      ) : (
        <>
          <p>
            Lichess · <strong style={{ color: COLOURS.leaf }}>{username}</strong>. Your moves played at least one time in five become your repertoire; then we show
            where you lose points.
          </p>
          {state.status === 'failed' && (
            <p role="alert" className="font-semibold" style={{ color: COLOURS.terracotta }}>
              {state.error ?? 'The import stopped. Try again.'}
            </p>
          )}
          <motion.button type="button" onClick={onImport} whileTap={{ scale: 0.97 }} transition={SPRING} className="self-start rounded-full px-6 py-2.5 text-[16px] font-bold focus-visible:outline-2" style={raised(true)}>
            {state.status === 'failed' ? 'Try again' : 'Import'}
          </motion.button>
        </>
      )}
    </Card>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <PageHeader />
      <main className="mx-auto flex max-w-[30rem] flex-col gap-4 px-4 pt-10">
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={SPRING} className="flex flex-col gap-4 rounded-3xl p-6 text-[15px]" style={{ ...raised(false), color: COLOURS.leafSoft }}>
          <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em]" style={{ color: COLOURS.leaf }}>
            {title}
          </h1>
          {children}
        </motion.section>
      </main>
    </>
  );
}
