export type Tone = 'losing' | 'slipping' | 'even' | 'winning';

export function toneOf(deficit: number): Tone {
  if (deficit >= 0.1) return 'losing';
  if (deficit >= 0.05) return 'slipping';
  if (deficit <= -0.05) return 'winning';
  return 'even';
}
