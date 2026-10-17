// PROTOTYPE JETABLE — POC 2 : le monde macro sur de vraies parties.
// Import chess.com (API publique) → arbre → évaluation Stockfish WASM locale → flame graph.
// Mesure au passage le coût réel de l'onboarding à froid.
import { useCallback, useRef, useState } from 'react';
import { StaticBoard } from '../../shared/components/Board/StaticBoard';
import { fetchArchives, fetchMonth, type RawGame } from './chesscom';
import { buildTree, findFindings, findDispersions, selectForEval, evalForUser, baseline, type Color, type Finding, type Tree, type TreeNode } from './tree';
import { BatchEngine } from './engine';
import { Flame } from './Flame';
import { Study, type Entry } from './Study';
import { Overview } from './Overview';
import { chantiers } from './chantiers';

const TIME_CLASSES = ['bullet', 'blitz', 'rapid', 'daily'] as const;
const cacheKey = (depth: number) => `poc-macro-evals-d${depth}`;
const DISMISSED_KEY = 'poc-macro-dismissed';

interface Timings { archives?: number; download?: number; parse?: number; evaluate?: number; total?: number }

export function MacroPrototypePage() {
  const [user, setUser] = useState('Piemme78');
  const [months, setMonths] = useState(0);
  const [maxPly, setMaxPly] = useState(16);
  const [minGames, setMinGames] = useState(6);
  const [depth, setDepth] = useState(12);
  const [floorCp, setFloorCp] = useState(50);
  const [minWeakGames, setMinWeakGames] = useState(40);
  const [dismissed, setDismissed] = useState<string[]>(() => JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]'));
  const [classes, setClasses] = useState<string[]>(['blitz', 'rapid']);

  const [phase, setPhase] = useState('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [timings, setTimings] = useState<Timings>({});
  const [tree, setTree] = useState<Tree | null>(null);
  const [evaluated, setEvaluated] = useState({ fromCache: 0, computed: 0 });
  const [color, setColor] = useState<Color>('white');
  const [selected, setSelected] = useState<TreeNode | null>(null);
  const [rawGames, setRawGames] = useState<RawGame[]>([]);
  const [study, setStudy] = useState<{ nodeId: string; entry: Entry } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, bump] = useState(0);
  const abort = useRef(false);

  const run = useCallback(async () => {
    abort.current = false;
    setError(null);
    setTree(null);
    setSelected(null);
    setStudy(null);
    setTimings({});
    setEvaluated({ fromCache: 0, computed: 0 });
    const t0 = performance.now();

    try {
      setPhase('archives');
      setProgress({ done: 0, total: 0 });
      const all = await fetchArchives(user);
      const urls = months > 0 ? all.slice(-months) : all;
      const tArchives = performance.now();
      setTimings((t) => ({ ...t, archives: tArchives - t0 }));

      setPhase('download');
      setProgress({ done: 0, total: urls.length });
      const games: RawGame[] = [];
      const queue = [...urls];
      const workers = Array.from({ length: 4 }, async () => {
        while (queue.length && !abort.current) {
          const url = queue.shift()!;
          const monthly = await fetchMonth(url, user);
          games.push(...monthly);
          setProgress((p) => ({ ...p, done: p.done + 1 }));
        }
      });
      await Promise.all(workers);
      const tDownload = performance.now();
      setTimings((t) => ({ ...t, download: tDownload - tArchives }));

      setPhase('parse');
      await new Promise((r) => setTimeout(r, 0));
      const kept = games.filter((g) => classes.includes(g.timeClass));
      setRawGames(kept);
      const built = buildTree(kept, maxPly);
      const tParse = performance.now();
      setTimings((t) => ({ ...t, parse: tParse - tDownload }));
      setTree(built);

      setPhase('eval');
      const targets = selectForEval(built, minGames, maxPly);
      setProgress({ done: 0, total: targets.length });

      const cache: Record<string, number> = JSON.parse(localStorage.getItem(cacheKey(depth)) ?? '{}');
      const engine = new BatchEngine();
      await engine.init();

      let fromCache = 0;
      let computed = 0;
      for (let i = 0; i < targets.length; i++) {
        if (abort.current) break;
        const node = targets[i];
        const hit = cache[node.epd];
        if (hit !== undefined) {
          node.evalCp = hit;
          fromCache++;
        } else {
          const { cp } = await engine.evaluate(node.fen, depth);
          node.evalCp = cp;
          cache[node.epd] = cp;
          computed++;
        }
        if (i % 5 === 0 || i === targets.length - 1) {
          setProgress({ done: i + 1, total: targets.length });
          setEvaluated({ fromCache, computed });
          bump((v) => v + 1);
        }
      }
      engine.terminate();
      try {
        localStorage.setItem(cacheKey(depth), JSON.stringify(cache));
      } catch {
        // quota dépassé : on se passe du cache, ce n'est qu'un POC
      }

      const tEval = performance.now();
      setTimings((t) => ({ ...t, evaluate: tEval - tParse, total: tEval - t0 }));
      setEvaluated({ fromCache, computed });
      setPhase('done');
      bump((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('idle');
    }
  }, [user, months, maxPly, minGames, depth, classes]);

  const findings = tree && phase === 'done' ? findFindings(tree, color, { minGames, floorCp, minWeakGames }) : [];
  const base = tree ? baseline(tree, color) : 0;
  const live = findings.filter((f) => !dismissed.includes(f.node.id));
  const leaks = live.filter((f) => f.kind === 'leak').slice(0, 10);
  const weak = live.filter((f) => f.kind === 'weak').slice(0, 6);
  const assumed = findings.filter((f) => dismissed.includes(f.node.id));
  const dispersions = tree && phase === 'done' ? findDispersions(tree, color, minWeakGames).slice(0, 8) : [];
  const priorities =
    tree && phase === 'done' ? chantiers({ tree, minGames, floorCp, minWeakGames, dismissed }) : [];

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
      return next;
    });
  };
  const running = phase !== 'idle' && phase !== 'done';

  if (study && tree) {
    return (
      <Study
        tree={tree}
        color={color}
        nodeId={study.nodeId}
        entry={study.entry}
        rawGames={rawGames}
        onBack={() => setStudy(null)}
      />
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#0f1216] px-8 py-6 text-slate-200">
      <header className="flex flex-wrap items-end gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">POC 2 — macro réel</div>
          <h1 className="mt-1 text-xl font-semibold text-white">Où partent tes points</h1>
        </div>

        <Field label="Compte chess.com">
          <input value={user} onChange={(e) => setUser(e.target.value)} className="w-36 rounded bg-slate-800 px-2 py-1 text-sm" />
        </Field>
        <Field label="Mois (0 = tout)">
          <input type="number" value={months} onChange={(e) => setMonths(Number(e.target.value))} className="w-20 rounded bg-slate-800 px-2 py-1 text-sm" />
        </Field>
        <Field label="Profondeur d'ouverture">
          <input type="number" value={maxPly} onChange={(e) => setMaxPly(Number(e.target.value))} className="w-20 rounded bg-slate-800 px-2 py-1 text-sm" />
        </Field>
        <Field label="Parties mini">
          <input type="number" value={minGames} onChange={(e) => setMinGames(Number(e.target.value))} className="w-20 rounded bg-slate-800 px-2 py-1 text-sm" />
        </Field>
        <Field label="Profondeur moteur">
          <input type="number" value={depth} onChange={(e) => setDepth(Number(e.target.value))} className="w-20 rounded bg-slate-800 px-2 py-1 text-sm" />
        </Field>
        <Field label="Plancher moteur (cp)">
          <input type="number" value={floorCp} onChange={(e) => setFloorCp(Number(e.target.value))} className="w-20 rounded bg-slate-800 px-2 py-1 text-sm" />
        </Field>
        <Field label="Zone faible dès">
          <input type="number" value={minWeakGames} onChange={(e) => setMinWeakGames(Number(e.target.value))} className="w-20 rounded bg-slate-800 px-2 py-1 text-sm" />
        </Field>
        <Field label="Cadences">
          <div className="flex gap-1">
            {TIME_CLASSES.map((c) => (
              <button
                key={c}
                onClick={() => setClasses((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]))}
                className={`rounded px-2 py-1 text-xs ${classes.includes(c) ? 'bg-slate-200 text-slate-900' : 'bg-slate-800 text-slate-400'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </Field>

        <button
          onClick={running ? () => { abort.current = true; } : run}
          className="ml-auto rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          {running ? 'Arrêter' : 'Lancer l’analyse'}
        </button>
        <button
          onClick={() => localStorage.removeItem(cacheKey(depth))}
          className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:bg-slate-800"
          title="Vide le cache d'évaluations pour mesurer un vrai départ à froid"
        >
          Vider le cache
        </button>
      </header>

      {error && <div className="mt-4 rounded border border-red-800 bg-red-950/40 px-4 py-2 text-sm text-red-300">{error}</div>}

      {phase !== 'idle' && (
        <section className="mt-5 flex flex-wrap items-center gap-6 text-sm">
          <Stat label="Phase" value={{ archives: 'archives', download: 'téléchargement', parse: 'agrégation', eval: 'évaluation', done: 'terminé' }[phase] ?? phase} />
          {progress.total > 0 && <Stat label="Avancement" value={`${progress.done} / ${progress.total}`} />}
          {tree && <Stat label="Parties" value={`${tree.parsed}`} />}
          {tree && <Stat label="Positions" value={`${Object.keys(tree.nodes).length}`} />}
          <Stat label="Évaluations" value={`${evaluated.computed} calculées · ${evaluated.fromCache} en cache`} />
          {timings.download !== undefined && <Stat label="Téléchargement" value={`${(timings.download / 1000).toFixed(1)}s`} />}
          {timings.parse !== undefined && <Stat label="Agrégation" value={`${(timings.parse / 1000).toFixed(1)}s`} />}
          {timings.evaluate !== undefined && <Stat label="Évaluation" value={`${(timings.evaluate / 1000).toFixed(1)}s`} />}
          {timings.total !== undefined && <Stat label="Total à froid" value={`${(timings.total / 1000).toFixed(1)}s`} tone="accent" />}
        </section>
      )}

      {tree && (
        <>
          <Overview
            items={priorities}
            onOpen={(item) => {
              setColor(item.color);
              setStudy({ nodeId: item.nodeId, entry: item.entry });
            }}
          />

          <div className="mt-8 flex items-center gap-2">
            {(['white', 'black'] as Color[]).map((c) => (
              <button
                key={c}
                onClick={() => { setColor(c); setSelected(null); }}
                className={`rounded px-3 py-1.5 text-sm ${color === c ? 'bg-slate-200 text-slate-900' : 'bg-slate-800 text-slate-400'}`}
              >
                {c === 'white' ? 'Mes blancs' : 'Mes noirs'} · {tree.gamesByColor[c]} parties
              </button>
            ))}
            <span className="ml-4 text-xs text-slate-500">
              largeur = parties · rouge = tu y marques moins que ta moyenne · vert = tu y marques plus
            </span>
          </div>

          <div className="mt-4">
            <Flame tree={tree} color={color} maxPly={maxPly} minWidth={0.35} selected={selected?.id ?? null} onSelect={setSelected} />
          </div>

          <div className="mt-8 grid grid-cols-[1fr_320px] gap-8">
            <div className="space-y-8">
              <FindingList
                title="Fuites d'ouverture"
                hint="le moteur pointe un coup fautif précis — directement préparable"
                findings={leaks}
                base={base}
                dismissed={false}
                onSelect={(id) => setStudy({ nodeId: id, entry: 'leak' })}
                onDismiss={dismiss}
                empty={phase === 'done' ? 'Aucune fuite au-dessus du plancher.' : ''}
              />
              <FindingList
                title="Zones faibles"
                hint="aucun coup fautif isolé — c'est la ligne entière qui rapporte peu"
                findings={weak}
                base={base}
                dismissed={false}
                onSelect={(id) => setStudy({ nodeId: id, entry: 'weak' })}
                onDismiss={dismiss}
                empty={phase === 'done' ? 'Rien à signaler.' : ''}
              />
              <div>
                <div className="flex items-baseline gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Pas de réponse arrêtée</h2>
                  {dispersions.length > 0 && (
                    <span className="font-mono text-xs text-sky-400">{dispersions.length} positions</span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-600">
                  tu alternes entre plusieurs coups qui ne se valent pas — l'écart de ton meilleur, par 100 parties
                </p>
                <div className="mt-3 space-y-1.5">
                  {dispersions.map((d) => (
                    <button
                      key={d.node.id}
                      onClick={() => setStudy({ nodeId: d.node.id, entry: 'dispersion' })}
                      className="flex w-full items-baseline gap-3 rounded border border-slate-800 px-3 py-2 text-left hover:border-slate-600"
                    >
                      <span className="font-mono text-sm text-slate-100">{d.node.id.split('|')[1] || 'position de départ'}</span>
                      <span className="ml-auto font-mono text-xs text-slate-500">{d.games} parties</span>
                      {!d.confident && (
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-slate-500">
                          à confirmer
                        </span>
                      )}
                      <span className="w-72 text-right font-mono text-xs">
                        {d.replies.map((r) => (
                          <span key={r.san} className={r.san === d.best.san ? 'text-emerald-400' : 'text-slate-500'}>
                            {r.san} {r.games}× {Math.round(r.rate * 100)}%{' '}
                          </span>
                        ))}
                      </span>
                      <span className="w-28 text-right font-mono text-sm text-sky-400">
                        +{Math.round(d.gap * 100)} pts / 100
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {assumed.length > 0 && (
                <FindingList
                  title="Écarts assumés"
                  hint="mis de côté volontairement"
                  findings={assumed}
                  base={base}
                  dismissed
                  onSelect={(id) => setStudy({ nodeId: id, entry: 'weak' })}
                  onDismiss={dismiss}
                  empty=""
                />
              )}
            </div>

            <aside>
              {selected ? (
                <div className="rounded-lg border border-slate-800 p-4">
                  <div className="font-mono text-xs text-slate-400">{selected.id.split('|')[1] || 'position de départ'}</div>
                  <div className="mt-3 overflow-hidden rounded border border-slate-800">
                    <StaticBoard fen={selected.fen} orientation={selected.color} />
                  </div>
                  <div className="mt-3 space-y-1 text-sm">
                    <Row label="Parties" value={`${selected.games}`} />
                    <Row label="Points" value={`${Math.round((selected.score / selected.games) * 100)}%`} />
                    <Row label="Éval" value={evalForUser(selected) !== undefined ? (evalForUser(selected)! / 100).toFixed(2) : '—'} />
                    <Row label="Demi-coup" value={`${selected.ply}`} />
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-800 p-6 text-sm text-slate-500">
                  Clique une bande ou une fuite pour voir la position.
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function FindingList({
  title, hint, findings, base, dismissed, empty, onSelect, onDismiss,
}: {
  title: string;
  hint: string;
  findings: Finding[];
  base: number;
  dismissed: boolean;
  empty: string;
  onSelect: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  return (
    <div className={dismissed ? 'opacity-50' : undefined}>
      <div className="flex items-baseline gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">{title}</h2>
        {findings.length > 0 && (
          <span className="font-mono text-xs text-amber-400">
            −{findings.reduce((sum, f) => sum + f.pointsLost, 0).toFixed(1)} pts au total
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-slate-600">{hint}</p>
      <div className="mt-3 space-y-1.5">
        {findings.map((f) => (
          <div
            key={f.node.id}
            className="flex items-baseline gap-3 rounded border border-slate-800 px-3 py-2 hover:border-slate-600"
          >
            <button onClick={() => onSelect(f.node.id)} className="flex flex-1 items-baseline gap-3 text-left">
              <span className="font-mono text-sm text-slate-100">{f.node.id.split('|')[1]}</span>
              {!f.confident && (
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-slate-500">
                  à confirmer
                </span>
              )}
              <span className="ml-auto font-mono text-xs text-slate-500">{f.games} parties</span>
              <span className="w-24 text-right font-mono text-xs text-slate-400">
                {Math.round(f.rate * 100)}% <span className="text-slate-600">/ {Math.round(base * 100)}%</span>
              </span>
              <span className="w-16 text-right font-mono text-sm text-red-400">
                {f.kind === 'leak' ? `−${f.lossCp}cp` : '—'}
              </span>
              <span className="w-20 text-right font-mono text-sm text-amber-400">−{f.pointsLost.toFixed(1)} pts</span>
            </button>
            <button
              onClick={() => onDismiss(f.node.id)}
              className="rounded border border-slate-800 px-2 py-0.5 text-[10px] text-slate-500 hover:bg-slate-800"
            >
              {dismissed ? 'reprendre' : 'assumé'}
            </button>
          </div>
        ))}
        {findings.length === 0 && empty && <div className="text-sm text-slate-500">{empty}</div>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'accent' }) {
  return (
    <span className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      <span className={`font-mono text-sm ${tone === 'accent' ? 'text-emerald-400' : 'text-slate-200'}`}>{value}</span>
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono text-slate-200">{value}</span>
    </div>
  );
}
