// PROTOTYPE — POC 3 : le monde micro, à l'échelle de la ligne. Jetable.
import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { StaticBoard } from '../../shared/components/Board/StaticBoard';
import type { RawGame } from './chesscom';
import { baseline, branches, dominantContinuation, firstMoves, gamesOnLine, lineSteps, type Color, type Tree } from './tree';

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
    () => gamesOnLine(rawGames, nodeId, firstMoves).sort((a, b) => b.endTime - a.endTime),
    [rawGames, nodeId],
  );


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

          <button className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500">
            Fixer cette ligne
          </button>
          <p className="text-[11px] leading-relaxed text-slate-600">
            Maquette : l’action ne fait rien. C’est elle qui, dans la v2, créerait la ligne de référence
            dont la prochaine partie dira si tu l’as suivie.
          </p>
        </aside>
      </div>
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
