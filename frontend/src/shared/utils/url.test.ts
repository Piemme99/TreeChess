import { describe, it, expect } from 'vitest';
import { isSafeHttpUrl } from './url';

describe('isSafeHttpUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isSafeHttpUrl('http://lichess.org/study/abcd1234')).toBe(true);
    expect(isSafeHttpUrl('https://lichess.org/study/abcd1234')).toBe(true);
  });

  it('rejects javascript: scheme', () => {
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects data: scheme', () => {
    expect(isSafeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('rejects other non-http schemes', () => {
    expect(isSafeHttpUrl('ftp://example.com/file')).toBe(false);
    expect(isSafeHttpUrl('mailto:user@example.com')).toBe(false);
    expect(isSafeHttpUrl('vbscript:msgbox(1)')).toBe(false);
  });

  it('rejects malformed / relative URLs that cannot be parsed', () => {
    expect(isSafeHttpUrl('not a url')).toBe(false);
    expect(isSafeHttpUrl('/study/abcd1234')).toBe(false);
  });

  it('rejects empty / nullish input', () => {
    expect(isSafeHttpUrl('')).toBe(false);
    expect(isSafeHttpUrl(undefined)).toBe(false);
    expect(isSafeHttpUrl(null)).toBe(false);
  });
});
