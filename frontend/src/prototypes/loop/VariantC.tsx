// PROTOTYPE — Variante C : fil d'actions priorisé. L'arbre n'est plus l'entrée, il devient une vue secondaire.
import { StaticBoard } from '../../shared/components/Board/StaticBoard';
import { ChevronDown, Check, BellRing } from 'lucide-react';
import {
  LEAKS, SCANDI, SCANDI_GAMES, ENGINE_LINES, GM_GAMES, TREE_NODES, TREE_EDGES,
  FEN_CRITICAL, FEN_BEST, FEN_PLAYED, LAST_GAME, PLAYER, PREPARED_ANSWER,
} from './data';

export const name = "Fil d'actions";

interface Props {
  step: number;
  onStep: (n: number) => void;
}

export function VariantC({ step, onStep }: Props) {
  const open = step === 2;
  const prepared = step >= 3;
  const nodeById = Object.fromEntries(TREE_NODES.map((n) => [n.id, n]));

  return (
    <div className="h-screen w-screen overflow-auto bg-[#f7f6f3] text-stone-900">
      <div className="mx-auto flex max-w-6xl gap-8 px-8 py-10">
        <main className="flex-1">
          <h1 className="text-[26px] font-semibold tracking-tight">À travailler</h1>
          <p className="mt-1 text-sm text-stone-500">
            Classé par ce que ça te coûte. {PLAYER.games} parties analysées.
          </p>

          {step === 4 && (
            <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-5">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                <BellRing size={13} /> Vérification
              </div>
              <div className="mt-2 text-[15px] font-medium">
                {LAST_GAME.date} — tu n'as pas appliqué ta préparation.
              </div>
              <div className="mt-1 text-sm text-stone-600">
                Position préparée il y a {LAST_GAME.daysSincePrep} jours. Tu as joué{' '}
                <b className="font-mono text-red-700">{LAST_GAME.played}</b> au lieu de{' '}
                <b className="font-mono text-emerald-700">{LAST_GAME.prepared}</b>.
              </div>
              <div className="mt-4 flex gap-4">
                <div className="w-28 overflow-hidden rounded-md ring-1 ring-stone-300">
                  <StaticBoard fen={FEN_PLAYED} arrows={[['g1', 'f3', 'rgb(220,38,38)']]} />
                </div>
                <div className="flex flex-col justify-center gap-2">
                  <button className="rounded-lg bg-stone-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-stone-700">
                    Rejouer la position
                  </button>
                  <button className="text-left text-xs text-stone-500 hover:text-stone-800">
                    Ma préparation était mauvaise, la changer
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 space-y-3">
            <article className={`rounded-xl border bg-white transition ${open || prepared ? 'border-stone-900/20 shadow-lg' : 'border-stone-200'}`}>
              <button
                onClick={() => onStep(open ? 1 : 2)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-sm font-semibold text-red-700">
                  1
                </span>
                <span className="flex-1">
                  <span className="block text-[15px] font-semibold">{SCANDI.opening}</span>
                  <span className="block font-mono text-xs text-stone-500">{SCANDI.line} · {SCANDI.played}</span>
                </span>
                {prepared && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                    <Check size={12} /> préparé
                  </span>
                )}
                <span className="text-right">
                  <span className="block font-mono text-base font-semibold text-red-700">−{SCANDI.pointsLost}</span>
                  <span className="block text-[11px] text-stone-500">{SCANDI.games} parties · {SCANDI.winRate}%</span>
                </span>
                <ChevronDown size={16} className={`shrink-0 text-stone-400 transition ${open ? 'rotate-180' : ''}`} />
              </button>

              {(open || prepared) && (
                <div className="border-t border-stone-150 px-5 py-5">
                  <div className="flex gap-6">
                    <div className="w-56 shrink-0">
                      <div className="overflow-hidden rounded-lg ring-1 ring-stone-200">
                        <StaticBoard
                          fen={prepared ? FEN_BEST : FEN_CRITICAL}
                          arrows={prepared ? [['d2', 'd4', 'rgb(5,150,105)']] : [['g1', 'f3', 'rgb(220,38,38)'], ['d2', 'd4', 'rgb(5,150,105)']]}
                        />
                      </div>
                      <div className="mt-3 space-y-1">
                        {ENGINE_LINES.map((l) => (
                          <div key={l.move} className="flex gap-2 font-mono text-[11px]">
                            <span className={`w-11 font-semibold ${l.move === SCANDI.played ? 'text-red-700' : 'text-emerald-700'}`}>
                              {l.eval}
                            </span>
                            <span className="truncate text-stone-500">{l.pv}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex-1">
                      {!prepared ? (
                        <>
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                            Tes parties perdues ici
                          </div>
                          <div className="mt-2 space-y-1">
                            {SCANDI_GAMES.map((g) => (
                              <div key={g.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-[13px] hover:bg-stone-50">
                                <span className={`h-2 w-2 rounded-full ${g.result === 'win' ? 'bg-emerald-500' : g.result === 'loss' ? 'bg-red-500' : 'bg-stone-400'}`} />
                                <span>{g.opponent}</span>
                                <span className="text-stone-400">{g.rating}</span>
                                <span className="ml-auto font-mono text-[11px] text-stone-400">{g.date}</span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                            Chez les maîtres
                          </div>
                          <div className="mt-2 space-y-1 text-[13px] text-stone-600">
                            {GM_GAMES.map((g) => (
                              <div key={g.white + g.year} className="flex gap-2">
                                <span>{g.white} — {g.black}</span>
                                <span className="ml-auto font-mono text-stone-400">{g.result}</span>
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={() => onStep(3)}
                            className="mt-5 rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-700"
                          >
                            Préparer 4.d4
                          </button>
                        </>
                      ) : (
                        <div className="rounded-lg bg-emerald-50 p-4">
                          <div className="font-mono text-base font-semibold text-emerald-800">{PREPARED_ANSWER.move}</div>
                          <div className="mt-1 font-mono text-xs text-stone-500">{PREPARED_ANSWER.line}</div>
                          <div className="mt-3 text-[13px] text-stone-600">
                            En attente de vérification : la prochaine fois que cette position tombe dans une de tes parties,
                            cette carte remonte en haut du fil.
                          </div>
                          {step === 3 && (
                            <button onClick={() => onStep(4)} className="mt-3 text-xs font-semibold text-emerald-800 hover:underline">
                              Simuler ma prochaine partie →
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </article>

            {LEAKS.slice(1).map((l, i) => (
              <article key={l.id} className="rounded-xl border border-stone-200 bg-white px-5 py-4">
                <div className="flex items-center gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-100 text-sm font-semibold text-stone-500">
                    {i + 2}
                  </span>
                  <div className="flex-1">
                    <div className="text-[15px] font-semibold">{l.opening}</div>
                    <div className="font-mono text-xs text-stone-500">{l.line}</div>
                    {l.note && <div className="mt-1 text-xs italic text-stone-400">{l.note}</div>}
                  </div>
                  {l.verdict === 'deliberate' && (
                    <button className="rounded-full border border-stone-300 px-3 py-1 text-[11px] text-stone-600 hover:bg-stone-50">
                      Ne plus proposer
                    </button>
                  )}
                  <div className="text-right">
                    <div className={`font-mono text-base font-semibold ${l.verdict === 'leak' ? 'text-red-700' : l.verdict === 'deliberate' ? 'text-amber-600' : 'text-emerald-700'}`}>
                      {l.verdict === 'fine' ? '+' : '−'}{l.pointsLost}
                    </div>
                    <div className="text-[11px] text-stone-500">{l.games} parties · {l.winRate}%</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </main>

        <aside className="w-64 shrink-0">
          <div className="sticky top-10 rounded-xl border border-stone-200 bg-white p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">Mon arbre</div>
            <svg viewBox="0 0 920 520" className="mt-3 w-full">
              {TREE_EDGES.map(([from, to]) => (
                <line
                  key={`${from}-${to}`}
                  x1={nodeById[from].x} y1={nodeById[from].y}
                  x2={nodeById[to].x} y2={nodeById[to].y}
                  stroke="#d6d3d1" strokeWidth={3}
                />
              ))}
              {TREE_NODES.map((n) => (
                <circle
                  key={n.id}
                  cx={n.x} cy={n.y} r={n.r}
                  fill={n.tone === 'leak' ? (n.id === 'scandi' && prepared ? '#059669' : '#dc2626') : n.tone === 'deliberate' ? '#d97706' : n.tone === 'good' ? '#059669' : '#a8a29e'}
                />
              ))}
            </svg>
            <button className="mt-3 w-full rounded-lg border border-stone-300 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50">
              Ouvrir l'arbre en grand
            </button>
            <p className="mt-3 text-[11px] leading-relaxed text-stone-400">
              Ici l'arbre n'est plus le point d'entrée : c'est une carte de ce que le fil a déjà trié.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
