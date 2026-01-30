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
    <div className="eval-bar">
      <div className="eval-bar-fill eval-bar-black" style={{ height: `${blackPercent}%` }} />
      <div className="eval-bar-fill eval-bar-white" style={{ height: `${clampedPercent}%` }} />
      {whiteAdvantage ? (
        <span className="eval-bar-label eval-bar-label--bottom">{scoreText}</span>
      ) : (
        <span className="eval-bar-label eval-bar-label--top">{scoreText}</span>
      )}
      <span className={`eval-bar-label-hover ${whiteAdvantage ? 'eval-bar-label-hover--white' : 'eval-bar-label-hover--black'}`}>
        {hoverText}
      </span>
    </div>
  );
}
