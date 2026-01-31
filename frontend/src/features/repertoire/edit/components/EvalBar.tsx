interface EvalBarProps {
  score: number | undefined;
  mate: number | undefined;
}

function scoreToWhitePercent(score: number | undefined, mate: number | undefined): number {
  if (mate !== undefined) {
    return mate > 0 ? 100 : 0;
  }
  if (score === undefined) return 50;
  return 50 + 50 * (2 / (1 + Math.exp(-score / 300)) - 1);
}

function formatScore(score: number | undefined, mate: number | undefined): string {
  if (mate !== undefined) {
    return `M${Math.abs(mate)}`;
  }
  if (score === undefined) return '';
  const pawns = Math.abs(score) / 100;
  return pawns.toFixed(1);
}

function formatScoreWithSign(score: number | undefined, mate: number | undefined): string {
  if (mate !== undefined) {
    return (mate > 0 ? '+' : '-') + `M${Math.abs(mate)}`;
  }
  if (score === undefined) return '';
  const pawns = score / 100;
  return (pawns >= 0 ? '+' : '') + pawns.toFixed(1);
}

export function EvalBar({ score, mate }: EvalBarProps) {
  const whitePercent = scoreToWhitePercent(score, mate);
  const clampedPercent = Math.max(5, Math.min(95, whitePercent));
  const blackPercent = 100 - clampedPercent;
  const scoreText = formatScore(score, mate);
  const hoverText = formatScoreWithSign(score, mate);
  const whiteAdvantage = whitePercent >= 50;

  return (
    <div className="group w-7 self-stretch rounded-sm shrink-0 relative shadow-sm border border-border">
      <div className="absolute left-0 right-0 top-0 bg-[#333] rounded-t-sm transition-[height] duration-300 ease-in-out" style={{ height: `${blackPercent}%` }} />
      <div className="absolute left-0 right-0 bottom-0 bg-[#f5f5f5] rounded-b-sm transition-[height] duration-300 ease-in-out" style={{ height: `${clampedPercent}%` }} />
      {whiteAdvantage ? (
        <span className="absolute left-0 right-0 text-center font-mono text-[0.625rem] font-bold leading-none select-none pointer-events-none z-[1] transition-opacity duration-150 text-[#333] bottom-1 group-hover:opacity-0">{scoreText}</span>
      ) : (
        <span className="absolute left-0 right-0 text-center font-mono text-[0.625rem] font-bold leading-none select-none pointer-events-none z-[1] transition-opacity duration-150 text-[#f5f5f5] top-1 group-hover:opacity-0">{scoreText}</span>
      )}
      <span className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[0.6875rem] font-bold py-0.5 px-1 rounded-sm whitespace-nowrap select-none pointer-events-none opacity-0 z-[2] transition-opacity duration-150 group-hover:opacity-100 ${whiteAdvantage ? 'text-[#333] bg-[rgba(245,245,245,0.9)]' : 'text-[#f5f5f5] bg-[rgba(51,51,51,0.9)]'}`}>
        {hoverText}
      </span>
    </div>
  );
}
