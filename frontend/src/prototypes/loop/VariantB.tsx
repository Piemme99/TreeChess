// PROTOTYPE — Variante B : deux mondes distincts (macro / salle d'étude) + rapport post-partie.
import { StaticBoard } from '../../shared/components/Board/StaticBoard';
import { ArrowLeft, BarChart3, Microscope } from 'lucide-react';
import {
  FLAME_ROWS, LEAKS, SCANDI, SCANDI_GAMES, ENGINE_LINES, GM_GAMES,
  FEN_CRITICAL, FEN_BEST, FEN_PLAYED, LAST_GAME, PLAYER, PREPARED_ANSWER,
} from './data';

export const name = 'Deux mondes';

const TONE: Record<string, string> = {
  neutral: '#2b3443',
  leak: '#dc2626',
  deliberate: '#a16207',
  good: '#166534',
};

interface Props {
  step: number;
  onStep: (n: number) => void;
}

export function VariantB({ step, onStep }: Props) {
  const mode = step === 1 ? 'macro' : step === 4 ? 'rapport' : 'etude';

  return (
    <div className="flex h-screen w-screen flex-col bg-[#0f1216] text-slate-200">
      <nav className="flex items-center gap-1 border-b border-slate-800 px-6 py-3">
        <span className="mr-6 font-semibold tracking-tight text-white">TreeChess</span>
        <Tab icon={<BarChart3 size={14} />} label="Macro" active={mode === 'macro'} onClick={() => onStep(1)} />
        <Tab icon={<Microscope size={14} />} label="Étude" active={mode === 'etude'} onClick={() => onStep(2)} />
        <span className="ml-auto text-xs text-slate-500">{PLAYER.name} · {PLAYER.games} parties</span>
      </nav>

      {mode === 'macro' && <Macro onOpen={() => onStep(2)} />}
      {mode === 'etude' && <Study step={step} onStep={onStep} />}
      {mode === 'rapport' && <Report onStep={onStep} />}
    </div>
  );
}

function Macro({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 overflow-auto p-8">
        <h1 className="text-2xl font-semibold text-white">Où partent tes points</h1>
        <p className="mt-1 text-sm text-slate-400">
          Largeur = nombre de parties. Rouge = tu perds des points par rapport à la théorie.
        </p>

        <div className="mt-8 space-y-1">
          {FLAME_ROWS.map((row, i) => (
            <div key={i} className="relative h-11">
              {row.map((seg) => (
                <button
                  key={seg.id}
                  onClick={() => seg.leakId === 'scandi' && onOpen()}
                  disabled={seg.leakId !== 'scandi'}
                  className="absolute top-0 h-full overflow-hidden rounded-[3px] px-2 text-left text-[11px] font-medium text-white/90 transition hover:brightness-125 disabled:cursor-default"
                  style={{
                    left: `${seg.offset}%`,
                    width: `calc(${seg.width}% - 2px)`,
                    background: TONE[seg.tone],
                  }}
                  title={seg.label}
                >
                  <span className="leading-[44px] whitespace-nowrap">{seg.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="mt-6 text-xs text-slate-500">↳ clique sur la bande rouge « 4.Cf3 — 11 parties »</div>
      </div>

      <aside className="w-[340px] shrink-0 border-l border-slate-800 p-6">
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Tes fuites, par coût</div>
        <div className="mt-4 space-y-2">
          {LEAKS.filter((l) => l.verdict !== 'fine').map((l) => (
            <button
              key={l.id}
              onClick={() => l.id === 'scandi' && onOpen()}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-left hover:border-slate-600"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-slate-100">{l.opening}</span>
                <span className={`font-mono text-sm ${l.verdict === 'leak' ? 'text-red-400' : 'text-amber-500'}`}>
                  −{l.pointsLost}
                </span>
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-slate-500">{l.line}</div>
              {l.note && <div className="mt-1 text-[11px] italic text-amber-600/80">{l.note}</div>}
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}

function Study({ step, onStep }: { step: number; onStep: (n: number) => void }) {
  const prepared = step >= 3;
  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex w-[420px] shrink-0 flex-col border-r border-slate-800 p-6">
        <button onClick={() => onStep(1)} className="mb-4 flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200">
          <ArrowLeft size={13} /> retour à la vue macro
        </button>
        <div className="text-[11px] uppercase tracking-[0.18em] text-red-400">{SCANDI.opening}</div>
        <div className="mt-1 font-mono text-[13px] text-slate-400">{SCANDI.line}</div>
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-800">
          <StaticBoard
            fen={prepared ? FEN_BEST : FEN_CRITICAL}
            arrows={prepared ? [['d2', 'd4', 'rgb(34,197,94)']] : [['g1', 'f3', 'rgb(239,68,68)'], ['d2', 'd4', 'rgb(34,197,94)']]}
          />
        </div>
        <div className="mt-4 space-y-1.5">
          {ENGINE_LINES.map((l) => (
            <div key={l.move} className="flex items-baseline gap-2 font-mono text-xs">
              <span className={`w-14 shrink-0 font-semibold ${l.move === SCANDI.played ? 'text-red-400' : 'text-emerald-400'}`}>
                {l.eval}
              </span>
              <span className="truncate text-slate-400">{l.pv}</span>
            </div>
          ))}
        </div>
        <div className="mt-auto pt-4 text-[11px] text-slate-600">Stockfish 16 · profondeur 22 · local</div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <h2 className="text-lg font-semibold text-white">Tes {SCANDI.games} parties sur cette position</h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-800">
          <table className="w-full text-sm">
            <tbody>
              {SCANDI_GAMES.map((g) => (
                <tr key={g.id} className="border-b border-slate-800/80 last:border-0 hover:bg-slate-800/40">
                  <td className="py-2.5 pl-4 pr-2 w-6">
                    <span className={`inline-block h-2 w-2 rounded-full ${g.result === 'win' ? 'bg-emerald-500' : g.result === 'loss' ? 'bg-red-500' : 'bg-slate-500'}`} />
                  </td>
                  <td className="py-2.5 pr-3 text-slate-200">{g.opponent}</td>
                  <td className="py-2.5 pr-3 text-slate-500">{g.rating}</td>
                  <td className="py-2.5 pr-3 font-mono text-xs text-slate-400">{g.movesAfter}</td>
                  <td className="py-2.5 pr-4 text-right text-xs text-slate-500">{g.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-8 text-lg font-semibold text-white">Comment les maîtres jouent cette position</h2>
        <div className="mt-4 space-y-2">
          {GM_GAMES.map((g) => (
            <div key={g.white + g.year} className="flex items-center gap-3 rounded-lg border border-slate-800 px-4 py-2.5 text-sm">
              <span className="text-slate-200">{g.white} — {g.black}</span>
              <span className="font-mono text-slate-400">{g.result}</span>
              <span className="ml-auto text-xs text-slate-500">{g.event} {g.year}</span>
            </div>
          ))}
        </div>
      </div>

      <aside className="w-[320px] shrink-0 border-l border-slate-800 p-6">
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Ma préparation</div>
        {!prepared ? (
          <>
            <p className="mt-3 text-sm text-slate-400">
              Choisis la réponse que tu veux jouer la prochaine fois dans cette position.
            </p>
            <div className="mt-4 space-y-2">
              {ENGINE_LINES.map((l) => (
                <button
                  key={l.move}
                  onClick={() => onStep(3)}
                  className="w-full rounded-lg border border-slate-800 px-3 py-2.5 text-left text-sm hover:border-emerald-600 hover:bg-emerald-950/30"
                >
                  <span className="font-mono font-semibold text-slate-100">{l.move}</span>
                  <span className="ml-2 font-mono text-xs text-slate-500">{l.eval}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-3 rounded-lg border border-emerald-800 bg-emerald-950/30 p-4">
            <div className="font-mono text-base font-semibold text-emerald-400">{PREPARED_ANSWER.move}</div>
            <div className="mt-1 font-mono text-xs text-slate-400">{PREPARED_ANSWER.line}</div>
            <div className="mt-3 text-xs text-slate-500">Enregistré {PREPARED_ANSWER.savedAt}.</div>
            <button onClick={() => onStep(4)} className="mt-3 text-xs font-semibold text-emerald-400 hover:underline">
              Et après ma prochaine partie ? →
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

function Report({ onStep }: { onStep: (n: number) => void }) {
  return (
    <div className="flex flex-1 items-center justify-center overflow-auto p-8">
      <div className="w-full max-w-3xl">
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Rapport de partie · {LAST_GAME.date}</div>
        <h1 className="mt-2 text-2xl font-semibold text-white">
          Tu avais préparé cette position il y a {LAST_GAME.daysSincePrep} jours.
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Défaite contre {LAST_GAME.opponent} ({LAST_GAME.rating}) · écart au coup {LAST_GAME.divergenceMove}
        </p>

        <div className="mt-8 grid grid-cols-2 gap-6">
          <div className="rounded-xl border border-emerald-800 bg-emerald-950/20 p-5">
            <div className="text-xs uppercase tracking-wider text-emerald-500">Ta préparation</div>
            <div className="mt-1 font-mono text-xl font-semibold text-emerald-400">{LAST_GAME.prepared}</div>
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-800">
              <StaticBoard fen={FEN_BEST} arrows={[['d2', 'd4', 'rgb(34,197,94)']]} />
            </div>
          </div>
          <div className="rounded-xl border border-red-900 bg-red-950/20 p-5">
            <div className="text-xs uppercase tracking-wider text-red-500">Ce que tu as joué</div>
            <div className="mt-1 font-mono text-xl font-semibold text-red-400">{LAST_GAME.played}</div>
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-800">
              <StaticBoard fen={FEN_PLAYED} arrows={[['g1', 'f3', 'rgb(239,68,68)']]} />
            </div>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button onClick={() => onStep(2)} className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-white">
            Rouvrir dans la salle d'étude
          </button>
          <button className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800">
            Revoir plus tard
          </button>
        </div>
      </div>
    </div>
  );
}

function Tab({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition ${
        active ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      {icon} {label}
    </button>
  );
}
