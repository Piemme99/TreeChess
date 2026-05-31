/** Maps an expected-score percentage to a Tailwind text-color class. */
export function getWinRateColor(winRate: number): string {
  if (winRate >= 55) return 'text-success';
  if (winRate >= 48) return 'text-primary';
  if (winRate >= 40) return 'text-amber-500';
  return 'text-danger';
}
