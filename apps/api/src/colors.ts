export const COLORS = [
  '#E69F00',
  '#56B4E9',
  '#009E73',
  '#F0E442',
  '#0072B2',
  '#D55E00',
  '#CC79A7',
  '#8C564B',
  '#17BECF',
  '#BCBD22',
];

export function pickColor(existing: string[] = []): string {
  const used = new Set(existing.map((c) => c.toUpperCase()));
  const free = COLORS.find((c) => !used.has(c.toUpperCase()));
  if (free) return free;
  return COLORS[existing.length % COLORS.length];
}
