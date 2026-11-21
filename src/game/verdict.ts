/** A one-line verdict for the final score. */
export function verdict(score: number, maxScore: number): string {
  const ratio = maxScore > 0 ? score / maxScore : 0
  if (ratio === 1) return 'Perfect score. Nothing gets past you.'
  if (ratio >= 0.7) return 'Sharp ears. Case closed.'
  if (ratio >= 0.4) return 'Solid detective work.'
  if (ratio > 0) return 'A few leads. Keep listening.'
  return 'The trail went cold this time.'
}
