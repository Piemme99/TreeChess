// PROTOTYPE — Variante A : tout se passe dans l'arbre, aucun changement de page.
import { StaticBoard } from '../../shared/components/Board/StaticBoard';
import {
  TREE_NODES, TREE_EDGES, SCANDI, SCANDI_GAMES, ENGINE_LINES, GM_GAMES,
  FEN_CRITICAL, FEN_BEST, FEN_PLAYED, LAST_GAME, PLAYER, PREPARED_ANSWER,
} from './data';

export const name = "Tout dans l'arbre";

const TONE: Record<string, string> = {
  root: '#64748b',
  neutral: '#334155',
  leak: '#ef4444',
  deliberate: '#ca8a04',
  good: '#15803d',
};

interface Props {
  step: number;
  onStep: (n: number) => void;
}

export function VariantA({ step, onStep }: Props) {
  const zoomed = step >= 2;
  const prepared = step >= 3;
  const nodeById = Object.fromEntries(TREE_NODES.map((n) => [n.id, n]));
  const k = zoomed ? 2.1 : 1;
  const focus = nodeById.scandi;
  const transform = zoomed
    ? `translate(${300 - k * focus.x} ${250 - k * focus.y}) scale(${k})`
    : 'translate(0 0) scale(1)';

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0b0e14] text-slate-200">
      <header className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-8 py-5">
        <div>
          <div className="text-[13px] uppercase tracking-[0.2em] text-slate-500">Mon arbre</div>
          <div className="mt-1 text-sm text-slate-400">
            {PLAYER.games} parties · {PLAYER.platform} · {PLAYER.name}
          </div>
        </div>
        <div className="flex items-center gap-5 text-xs text-slate-400">
          <Legend color={TONE.leak} label="Fuite coûteuse" />
          <Legend color={TONE.deliberate} label="Écart assumé" />
          <Legend color={TONE.good} label="Solide" />
        </div>
      </header>

      {step === 4 && (
        <div className="absolute left-1/2 top-20 z-20 w-[560px] -translate-x-1/2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 backdrop-blur">
          <div className="text-sm font-semibold text-amber-300">
            {LAST_GAME.date} contre {LAST_GAME.opponent} ({LAST_GAME.rating})
          </div>
          <div className="mt-1 text-sm text-slate-300">
            Tu avais préparé <b className="text-emerald-400">{LAST_GAME.prepared}</b> il y a {LAST_GAME.daysSincePrep} jours.
            Tu as joué <b className="text-red-400">{LAST_GAME.played}</b>.
          </div>
          <button className="mt-3 rounded-md bg-amber-500/90 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-400">
            Revoir la position
          </button>
        </div>
      )}

      <svg viewBox="0 0 920 520" className="h-full w-full">
        <g style={{ transition: 'transform 600ms cubic-bezier(.4,0,.2,1)' }} transform={transform}>
          {TREE_EDGES.map(([from, to]) => {
            const a = nodeById[from];
            const b = nodeById[to];
            const dim = zoomed && !['exd5', 'qa5', 'scandi', 'd4b', 'nf6', 'd5', 'e4', 'root'].includes(to);
            return (
              <line
                key={`${from}-${to}`}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="#1e293b"
                strokeWidth={dim ? 1 : 2}
                opacity={dim ? 0.25 : 1}
              />
            );
          })}
          {TREE_NODES.map((n) => {
            const isFocus = n.id === 'scandi';
            const dim = zoomed && !isFocus && !['exd5', 'qa5', 'd4b', 'nf6', 'd5'].includes(n.id);
            const fill = isFocus && prepared ? TONE.good : TONE[n.tone];
            return (
              <g
                key={n.id}
                opacity={dim ? 0.2 : 1}
                style={{ cursor: n.leakId ? 'pointer' : 'default', transition: 'opacity 400ms' }}
                onClick={() => n.id === 'scandi' && onStep(2)}
              >
                {isFocus && !zoomed && (
                  <circle cx={n.x} cy={n.y} r={n.r + 10} fill={TONE.leak} opacity={0.18}>
                    <animate attributeName="r" values={`${n.r + 6};${n.r + 16};${n.r + 6}`} dur="2.4s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle cx={n.x} cy={n.y} r={n.r} fill={fill} stroke="#0b0e14" strokeWidth={2} />
                <text
                  x={n.x}
                  y={n.y + n.r + 13}
                  textAnchor="middle"
                  fontSize={n.r > 15 ? 12 : 10}
                  fill="#94a3b8"
                >
                  {n.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {!zoomed && (
        <div className="absolute bottom-24 left-8 max-w-xs text-sm text-slate-500">
          Plus un coup est joué souvent, plus son point est gros. Plus il te coûte de points, plus il est rouge.
          <div className="mt-2 text-slate-400">↳ clique sur le gros point rouge</div>
        </div>
      )}

      <aside
        className="absolute right-0 top-0 h-full w-[460px] border-l border-slate-800 bg-[#11151e] p-6 overflow-y-auto"
        style={{
          transform: zoomed ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 500ms cubic-bezier(.4,0,.2,1)',
        }}
      >
        <div className="text-[11px] uppercase tracking-[0.18em] text-red-400">Fuite · {SCANDI.pointsLost} pts perdus</div>
        <h2 className="mt-1 text-xl font-semibold text-white">{SCANDI.opening}</h2>
        <div className="mt-1 font-mono text-[13px] text-slate-400">{SCANDI.line}</div>

        <div className="mt-5 overflow-hidden rounded-lg border border-slate-800">
          <StaticBoard
            fen={prepared ? FEN_BEST : FEN_CRITICAL}
            arrows={prepared ? [['d2', 'd4', 'rgb(34,197,94)']] : [['g1', 'f3', 'rgb(239,68,68)'], ['d2', 'd4', 'rgb(34,197,94)']]}
          />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="Parties" value={`${SCANDI.games}`} />
          <Stat label="Victoires" value={`${SCANDI.winRate}%`} tone="bad" />
          <Stat label="Éval" value={`${SCANDI.evalPlayed}`} tone="bad" />
        </div>

        <Section title="Pourquoi c'est mauvais">
          <div className="space-y-1.5">
            {ENGINE_LINES.map((l) => (
              <div key={l.move} className="flex items-baseline gap-2 font-mono text-xs">
                <span className={`w-14 shrink-0 font-semibold ${l.move === SCANDI.played ? 'text-red-400' : 'text-emerald-400'}`}>
                  {l.eval}
                </span>
                <span className="text-slate-400">{l.pv}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title={`Tes ${SCANDI.games} parties sur cette position`}>
          <div className="space-y-1">
            {SCANDI_GAMES.map((g) => (
              <div key={g.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-slate-800/60">
                <ResultDot result={g.result} />
                <span className="text-slate-300">{g.opponent}</span>
                <span className="text-slate-600">{g.rating}</span>
                <span className="ml-auto font-mono text-[11px] text-slate-500">{g.movesAfter}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Parties de maîtres sur cette position">
          <div className="space-y-1">
            {GM_GAMES.map((g) => (
              <div key={g.white + g.year} className="flex items-center gap-2 text-xs text-slate-400">
                <span className="text-slate-300">{g.white} — {g.black}</span>
                <span className="ml-auto font-mono">{g.result}</span>
                <span className="w-10 text-right text-slate-600">{g.year}</span>
              </div>
            ))}
          </div>
        </Section>

        {!prepared ? (
          <button
            onClick={() => onStep(3)}
            className="mt-6 w-full rounded-lg bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Préparer 4.d4 ici
          </button>
        ) : (
          <div className="mt-6 rounded-lg border border-emerald-700/60 bg-emerald-900/20 p-4">
            <div className="text-sm font-semibold text-emerald-400">Préparé · {PREPARED_ANSWER.savedAt}</div>
            <div className="mt-1 font-mono text-xs text-slate-400">{PREPARED_ANSWER.line}</div>
            <div className="mt-2 text-xs text-slate-500">
              Le nœud est passé au vert dans l'arbre. La prochaine partie sur cette position te dira si tu l'as appliqué.
            </div>
            <button onClick={() => onStep(4)} className="mt-3 text-xs font-semibold text-emerald-400 hover:underline">
              Voir ce que ça donne après ma prochaine partie →
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="mt-4 rounded-lg border border-red-800/60 bg-red-950/30 p-4">
            <div className="text-sm font-semibold text-red-400">Non appliqué</div>
            <div className="mt-1 text-xs text-slate-400">
              Contre {LAST_GAME.opponent}, tu as rejoué {LAST_GAME.played}.
            </div>
            <div className="mt-3 overflow-hidden rounded border border-slate-800">
              <StaticBoard fen={FEN_PLAYED} arrows={[['g1', 'f3', 'rgb(239,68,68)']]} />
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'bad' }) {
  return (
    <div className="rounded-md bg-slate-800/50 py-2">
      <div className={`text-lg font-semibold ${tone === 'bad' ? 'text-red-400' : 'text-slate-100'}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="mb-2 text-[11px] uppercase tracking-[0.15em] text-slate-500">{title}</div>
      {children}
    </div>
  );
}

function ResultDot({ result }: { result: 'win' | 'loss' | 'draw' }) {
  const color = result === 'win' ? 'bg-emerald-500' : result === 'loss' ? 'bg-red-500' : 'bg-slate-500';
  return <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />;
}
