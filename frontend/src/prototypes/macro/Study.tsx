// PROTOTYPE — POC 3 : le monde micro, à l'échelle de la ligne. Jetable.
import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { StaticBoard } from '../../shared/components/Board/StaticBoard';
import type { RawGame } from './chesscom';
import { baseline, branches, dominantContinuation, gamesOnLine, lineSteps, type Color, type Tree } from './tree';
import { buildPrep, verifyPrep } from './prep';
import { BatchEngine } from './engine';
import { Chess } from 'chess.js';

export type Entry = 'leak' | 'weak' | 'dispersion';

const ENTRY_LABEL: Record<Entry, string> = {
  leak: 'Fuite d’ouverture',
  weak: 'Zone faible',
  dispersion: 'Pas de réponse arrêtée',
};

const ENTRY_GESTURE: Record<Entry, string> = {
  leak: 'Un coup est fautif : remplace-le.',
  weak: 'Aucun coup fautif isolé : trouve où la ligne décroche.',
  dispersion: 'Tu alternes entre plusieurs coups : arrête-toi sur un.',
};

interface Props {
  tree: Tree;
  color: Color;
  nodeId: string;
  entry: Entry;
  rawGames: RawGame[];
  onBack: () => void;
}

export function Study({ tree, color, nodeId, entry, rawGames, onBack }: Props) {
  const found = useMemo(() => lineSteps(tree, nodeId), [tree, nodeId]);
  const after = useMemo(() => dominantContinuation(tree, nodeId, 16), [tree, nodeId]);
  const steps = useMemo(() => [...found, ...after], [found, after]);
  const base = baseline(tree, color);
  const [focusPly, setFocusPly] = useState(found.length);
  const [prepOpen, setPrepOpen] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [engineAdvice, setEngineAdvice] = useState<Record<string, { san: string; cp: number }[]>>({});
  const [searching, setSearching] = useState<string | null>(null);

  const entryStep = found[found.length - 1];
  const verdict =
    entryStep && entryStep.evalUser !== undefined && entryStep.evalUser > 20 && entryStep.rate < base
      ? `Le moteur te donne ${(entryStep.evalUser / 100).toFixed(2)} après ${entryStep.san}, et tu y marques ${Math.round(
          entryStep.rate * 100,
        )}%. Ce n'est pas la position qui pêche, c'est ce que tu en fais.`
      : null;

  const focusNode = focusPly === 0 ? tree.nodes[tree.roots[color]] : steps[focusPly - 1]?.node;
  const nextOnLine = steps[focusPly]?.node.id;
  const allForks = focusNode ? branches(tree, focusNode, nextOnLine) : [];
  // Une réponse vue deux fois n'est pas une réponse : elle brouille la lecture.
  const forks = allForks.filter((b) => b.games >= 3 || b.onLine);
  const rare = allForks.length - forks.length;
  const userToMove = focusNode?.userToMove ?? false;

  const games = useMemo(
    () => gamesOnLine(rawGames, nodeId).sort((a, b) => b.endTime - a.endTime),
    [rawGames, nodeId],
  );

  const prep = useMemo(
    () =>
      buildPrep(
        tree,
        nodeId,
        {
          maxPly: 16,
          targetCoverage: 0.9,
          minBranchGames: 5,
          minLineGames: Math.max(6, (entryStep?.games ?? 0) * 0.04),
        },
        overrides,
      ),
    [tree, nodeId, overrides, entryStep],
  );
  const report = useMemo(() => verifyPrep(prep, games), [prep, games]);
  const focusPath = focusNode ? focusNode.id.split('|')[1] ?? '' : '';
  const prepChoice = prep.choices[focusPath];

  const lastGame = useMemo(() => {
    const newest = games[0];
    return newest ? report.verdicts.find((v) => v.game === newest) ?? null : null;
  }, [games, report]);

  const lastGameLine = useMemo(() => {
    if (!lastGame) return '';
    const move = Math.ceil((lastGame.ply + 1) / 2);
    if (lastGame.outcome === 'left') {
      return `Tu as quitté ta ligne au coup ${move} : tu as joué ${lastGame.played}, ta ligne dit ${lastGame.expected}.`;
    }
    if (lastGame.outcome === 'uncovered') {
      return `L'adversaire est sorti de ta couverture au coup ${move} avec ${lastGame.played} — tu n'avais rien de prêt.`;
    }
    return lastGame.game.score === 1
      ? `Tu as suivi ta ligne et gagné.`
      : `Tu as suivi ta ligne jusqu'au bout et tu as quand même ${
          lastGame.game.score === 0 ? 'perdu' : 'fait nulle'
        } : c'est la ligne qui est en cause, pas son application.`;
  }, [lastGame]);

  /** L'avis du moteur sur une position que le joueur n'a pas tranchée. */
  const askEngine = async (path: string) => {
    const node = tree.nodes[`${color}|${path}`];
    if (!node) return;
    setSearching(path);
    const engine = new BatchEngine();
    await engine.init();
    const lines = await engine.evaluateLines(node.fen, 14, 3);
    engine.terminate();

    setEngineAdvice((prev) => ({
      ...prev,
      [path]: lines.map((l) => {
        const chess = new Chess(node.fen);
        let san = l.uci;
        try {
          san = chess.move({ from: l.uci.slice(0, 2), to: l.uci.slice(2, 4), promotion: l.uci[4] }).san;
        } catch {
          // coup illisible : on garde l'UCI, c'est un prototype
        }
        return { san, cp: l.cp };
      }),
    }));
    setSearching(null);
  };

  const verdictLine = useMemo(() => {
    const { counts, scores } = report;
    if (counts.followed < 15 || counts.left < 15) return null;
    const held = scores.followed / counts.followed;
    const drifted = scores.left / counts.left;
    const gap = Math.round((held - drifted) * 100);

    if (gap > 5) return `Te tenir à ta ligne vaut ${gap} points de plus pour 100 parties : ici, le problème est la régularité.`;
    if (gap < -5) return `Tes écarts marquent ${-gap} points de plus que ta ligne de fait : c'est la ligne qu'il faut changer, pas ta régularité.`;
    return 'Ta ligne et tes écarts se valent : te tenir à ce que tu joues déjà ne réparera rien ici, il faut changer de système.';
  }, [report]);


  return (
    <div className="min-h-screen bg-[#0f1216] text-slate-200">
      <nav className="flex items-center gap-4 border-b border-slate-800 px-8 py-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200">
          <ArrowLeft size={13} /> retour au macro
        </button>
        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-400">
          {ENTRY_LABEL[entry]}
        </span>
        <span className="font-mono text-sm text-slate-100">{nodeId.split('|')[1]}</span>
        <span className="ml-auto font-mono text-xs text-slate-500">
          {entryStep?.games} parties · {Math.round((entryStep?.rate ?? 0) * 100)}%{' '}
          <span className="text-slate-700">/ {Math.round(base * 100)}%</span>
        </span>
      </nav>

      <div className="px-8 pt-4">
        <p className="text-sm text-slate-400">{ENTRY_GESTURE[entry]}</p>
        {verdict && <p className="mt-1 text-sm text-amber-300">{verdict}</p>}
      </div>

      <div className="grid grid-cols-[360px_1fr_320px] gap-8 px-8 py-6">
        <div>
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <StaticBoard fen={focusNode?.fen ?? ''} orientation={color} />
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            <Chip label="départ" active={focusPly === 0} onClick={() => setFocusPly(0)} />
            {steps.map((s) => (
              <Chip
                key={s.ply}
                label={s.san}
                active={focusPly === s.ply}
                byUser={s.byUser}
                faded={s.ply > found.length}
                onClick={() => setFocusPly(s.ply)}
              />
            ))}
          </div>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Où ça décroche</h2>
            <p className="mt-0.5 text-xs text-slate-600">
              ton score au fil de la ligne — la barre part de ta moyenne, {Math.round(base * 100)}%.
              En dessous du trait, la suite la plus fréquente.
            </p>
            <div className="mt-4 space-y-1">
              {steps.map((s) => {
                const delta = s.rate - base;
                const firstAfter = s.ply === found.length + 1;
                const width = Math.min(50, Math.abs(delta) * 200);
                return (
                  <div key={s.ply}>
                  {firstAfter && <div className="my-1 border-t border-dashed border-slate-800" />}
                  <button
                    onClick={() => setFocusPly(s.ply)}
                    className={`flex w-full items-center gap-3 rounded px-2 py-1 text-left text-xs hover:bg-slate-800/60 ${
                      focusPly === s.ply ? 'bg-slate-800/80' : ''
                    } ${s.ply > found.length ? 'opacity-60' : ''}`}
                  >
                    <span className={`w-16 font-mono ${s.byUser ? 'text-slate-100' : 'text-slate-500'}`}>{s.san}</span>
                    <span className="w-16 font-mono text-slate-600">{s.games}×</span>
                    <span className="relative h-3 flex-1">
                      <span className="absolute left-1/2 top-0 h-full w-px bg-slate-700" />
                      <span
                        className="absolute top-0 h-full rounded-sm"
                        style={{
                          background: delta < 0 ? '#dc2626' : '#166534',
                          width: `${width}%`,
                          left: delta < 0 ? `${50 - width}%` : '50%',
                        }}
                      />
                    </span>
                    <span className={`w-12 text-right font-mono ${delta < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {Math.round(s.rate * 100)}%
                    </span>
                    <span className="w-14 text-right font-mono text-slate-600">
                      {s.evalUser !== undefined ? (s.evalUser / 100).toFixed(2) : '—'}
                    </span>
                  </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              {userToMove ? 'Tes réponses ici' : 'Ce que l’adversaire joue ici'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              {userToMove
                ? 'ce que chacune te rapporte — la ligne courante est encadrée'
                : 'contre quoi tu te défends, et ce que ça te coûte'}
            </p>
            <div className="mt-3 space-y-1">
              {forks.slice(0, 8).map((b) => {
                const delta = b.rate - base;
                return (
                  <div
                    key={b.san}
                    className={`flex items-baseline gap-3 rounded border px-3 py-1.5 text-xs ${
                      b.onLine ? 'border-slate-500 bg-slate-800/50' : 'border-slate-800'
                    }`}
                  >
                    <span className="w-16 font-mono text-sm text-slate-100">{b.san}</span>
                    <span className="w-20 font-mono text-slate-500">{b.games} parties</span>
                    <span className="w-16 font-mono text-slate-600">
                      {Math.round((b.games / (focusNode?.games ?? 1)) * 100)}%
                    </span>
                    <span className={`ml-auto w-12 text-right font-mono ${delta < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {Math.round(b.rate * 100)}%
                    </span>
                    <span className="w-14 text-right font-mono text-slate-600">
                      {b.evalUser !== undefined ? (b.evalUser / 100).toFixed(2) : '—'}
                    </span>
                    {prepOpen && userToMove && (
                      <button
                        onClick={() => setOverrides((o) => ({ ...o, [focusPath]: b.san }))}
                        className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                          prepChoice === b.san
                            ? 'bg-emerald-600 text-white'
                            : 'border border-slate-700 text-slate-500 hover:bg-slate-800'
                        }`}
                      >
                        {prepChoice === b.san ? 'retenu' : 'retenir'}
                      </button>
                    )}
                  </div>
                );
              })}
              {forks.length === 0 && <div className="text-sm text-slate-500">Fin de l’arbre à cette profondeur.</div>}
              {rare > 0 && (
                <div className="px-3 pt-1 text-[11px] text-slate-600">
                  {rare} autres réponses vues moins de trois fois, masquées.
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Tes parties sur cette ligne
            </h2>
            <div className="mt-3 max-h-80 space-y-1 overflow-y-auto">
              {games.slice(0, 40).map((g, i) => (
                <div key={i} className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-slate-800/60">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      g.score === 1 ? 'bg-emerald-500' : g.score === 0 ? 'bg-red-500' : 'bg-slate-500'
                    }`}
                  />
                  <span className="text-slate-400">{g.timeClass}</span>
                  <span className="ml-auto font-mono text-slate-600">
                    {new Date(g.endTime * 1000).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              ))}
              {games.length === 0 && <div className="text-xs text-slate-600">Aucune partie retrouvée.</div>}
            </div>
          </div>

          {!prepOpen ? (
            <>
              <button
                onClick={() => setPrepOpen(true)}
                className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                Fixer cette ligne
              </button>
              <p className="text-[11px] leading-relaxed text-slate-600">
                Choisir ton coup à chaque position où tu as la main, sur les bifurcations adverses qui
                pèsent. Ni une séquence unique, ni un répertoire complet.
              </p>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Ta ligne de référence</h2>
                <button onClick={() => setPrepOpen(false)} className="text-[11px] text-slate-500 hover:text-slate-300">
                  fermer
                </button>
              </div>

              <div className="rounded-lg border border-slate-800 p-3">
                <div className="font-mono text-2xl text-emerald-400">{Math.round(report.coverage * 100)}%</div>
                <div className="text-[11px] text-slate-500">
                  de tes {games.length} parties sur cette ligne seraient couvertes
                </div>
                <div className="mt-2 text-[11px] text-slate-500">
                  ta ligne porte jusqu'au coup <b className="text-slate-300">{report.reach}</b>
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <Bucket
                  label="Tu jouais déjà cette ligne"
                  count={report.counts.followed}
                  score={report.scores.followed}
                  tone="emerald"
                />
                <Bucket label="Tu en es sorti toi-même" count={report.counts.left} score={report.scores.left} tone="amber" />
                <Bucket
                  label="Adversaire hors couverture"
                  count={report.counts.uncovered}
                  score={report.scores.uncovered}
                  tone="red"
                />
              </div>

              {verdictLine && (
                <p className="rounded-lg border border-slate-700 bg-slate-800/40 p-3 text-xs leading-relaxed text-amber-200">
                  {verdictLine}
                </p>
              )}

              {report.counts.followed > 0 && (
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Quand tu t'y tiens tu marques{' '}
                  <b className="text-slate-300">
                    {Math.round((report.scores.followed / report.counts.followed) * 100)}%
                  </b>
                  {report.counts.left > 0 && (
                    <>
                      , contre{' '}
                      <b className="text-slate-300">
                        {Math.round((report.scores.left / report.counts.left) * 100)}%
                      </b>{' '}
                      quand tu improvises
                    </>
                  )}
                  .
                </p>
              )}

              {lastGame && (
                <div className="rounded-lg border border-slate-700 p-3">
                  <h3 className="text-[11px] uppercase tracking-wider text-slate-500">Ta dernière partie ici</h3>
                  <div className="mt-1 text-xs text-slate-400">
                    {new Date(lastGame.game.endTime * 1000).toLocaleDateString('fr-FR')} contre{' '}
                    {lastGame.game.opponent} ({lastGame.game.opponentRating}) —{' '}
                    {lastGame.game.score === 1 ? 'gagnée' : lastGame.game.score === 0 ? 'perdue' : 'nulle'}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-300">{lastGameLine}</p>
                </div>
              )}

              {prep.frontier.length > 0 && (
                <div>
                  <h3 className="text-[11px] uppercase tracking-wider text-slate-500">Points à trancher</h3>
                  <p className="text-[10px] text-slate-600">là où ta ligne s'arrête : pas d'habitude nette</p>
                  <div className="mt-1 space-y-1">
                    {prep.frontier.slice(0, 4).map((f) => (
                      <div key={f.path} className="rounded border border-slate-800 px-2 py-1 text-[11px]">
                        <div className="flex items-baseline gap-2">
                          <span className="truncate font-mono text-slate-400">après {f.path || 'le départ'}</span>
                          <button
                            onClick={() => askEngine(f.path)}
                            disabled={searching === f.path}
                            className="ml-auto shrink-0 text-[10px] uppercase tracking-wider text-emerald-400 hover:underline disabled:text-slate-600"
                          >
                            {searching === f.path ? 'calcul…' : 'avis moteur'}
                          </button>
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-2 font-mono text-slate-500">
                          {f.options.map((o) => (
                            <span key={o.san}>
                              {o.san} {o.games}× {Math.round(o.rate * 100)}%
                            </span>
                          ))}
                        </div>
                        {engineAdvice[f.path] && (
                          <div className="mt-1 flex flex-wrap gap-2 border-t border-slate-800 pt-1 font-mono text-emerald-400/80">
                            {engineAdvice[f.path].map((a) => (
                              <span key={a.san}>
                                {a.san} {(a.cp / 100).toFixed(2)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {report.driftByPly.length > 0 && (
                <div>
                  <h3 className="text-[11px] uppercase tracking-wider text-slate-500">Où tu quittes ta ligne</h3>
                  <div className="mt-1 space-y-0.5">
                    {report.driftByPly.slice(0, 4).map((d) => (
                      <div key={d.ply} className="flex items-baseline gap-2 text-[11px]">
                        <span className="text-slate-400">coup {Math.ceil((d.ply + 1) / 2)}</span>
                        <span className="ml-auto font-mono text-slate-500">{d.games}×</span>
                        <span className="w-10 text-right font-mono text-slate-500">
                          {Math.round((d.score / d.games) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {report.holes.length > 0 && (
                <div>
                  <h3 className="text-[11px] uppercase tracking-wider text-slate-500">Trous à combler</h3>
                  <div className="mt-1 space-y-0.5">
                    {report.holes.slice(0, 6).map((h) => (
                      <div key={h.path + h.san} className="flex items-baseline gap-2 text-[11px]">
                        <span className="font-mono text-slate-300">{h.san}</span>
                        <span className="truncate text-slate-600">après {h.path || 'le départ'}</span>
                        <span className="ml-auto font-mono text-slate-500">{h.games}×</span>
                        <span className="w-10 text-right font-mono text-slate-500">
                          {Math.round((h.score / h.games) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[11px] leading-relaxed text-slate-600">
                Clique « retenir » sur une réponse à gauche pour changer ton coup : la couverture et le
                score se recalculent sur tes parties réelles.
              </p>
            </div>
          )}

        </aside>
      </div>
    </div>
  );
}

const BUCKET_DOT: Record<string, string> = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
};

function Bucket({ label, count, score, tone }: { label: string; count: number; score: number; tone: string }) {
  return (
    <div className="flex items-baseline gap-2 rounded border border-slate-800 px-2 py-1.5">
      <span className={`h-2 w-2 shrink-0 rounded-full ${BUCKET_DOT[tone]}`} />
      <span className="text-slate-400">{label}</span>
      <span className="ml-auto font-mono text-slate-200">{count}</span>
      <span className="w-10 text-right font-mono text-slate-500">
        {count > 0 ? `${Math.round((score / count) * 100)}%` : '—'}
      </span>
    </div>
  );
}

function Chip({
  label, active, byUser, faded, onClick,
}: { label: string; active: boolean; byUser?: boolean; faded?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-2 py-1 font-mono text-xs transition ${
        active ? 'bg-slate-100 text-slate-900' : byUser === false ? 'bg-slate-900 text-slate-500' : 'bg-slate-800 text-slate-300'
      } ${faded && !active ? 'opacity-50' : ''}`}
    >
      {label}
    </button>
  );
}
