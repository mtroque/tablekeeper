const DATE = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

export function formatPlayedAt(iso: string): string {
  return DATE.format(new Date(iso));
}

export function points(total: number | null): string {
  if (total === null) return 'Not Scored';
  return `${total} ${Math.abs(total) === 1 ? 'Point' : 'Points'}`;
}
