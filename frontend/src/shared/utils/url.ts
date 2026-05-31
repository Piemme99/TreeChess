/**
 * Returns true only when `url` is a well-formed absolute http(s) URL.
 *
 * Guards anchors that render externally-sourced links (e.g. imported-study
 * metadata) against unsafe schemes such as `javascript:` or `data:`. Anything
 * that fails to parse, or uses a non-http(s) protocol, is rejected.
 */
export function isSafeHttpUrl(url: string | undefined | null): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
