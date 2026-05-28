/**
 * Normalise a username pasted by the user before sending it to an import API.
 *
 * Handles the common cases that previously caused silent import failures:
 * - surrounding whitespace
 * - a leading "@" (e.g. "@DrNykterstein")
 * - a full profile URL pasted instead of the handle
 *   (e.g. "https://lichess.org/@/thibault", "chess.com/member/hikaru")
 */
export function sanitizeUsername(raw: string): string {
  let value = raw.trim();
  if (!value) return '';

  // If a profile URL was pasted, keep only the last meaningful path segment.
  if (/^https?:\/\//i.test(value) || /(?:lichess\.org|chess\.com)\//i.test(value)) {
    const withoutQuery = value.split(/[?#]/)[0];
    const segments = withoutQuery.split('/').filter((s) => s && s !== '@');
    value = segments[segments.length - 1] ?? value;
  }

  // Strip any leading "@" left over (e.g. "@user").
  value = value.replace(/^@+/, '');

  return value.trim();
}
