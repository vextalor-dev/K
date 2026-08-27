import { describe, it, expect } from 'vitest';
import { esc, matchPct, yearOf, titleOf, mediaTypeOf, clamp } from '../public/js/utils.js';

describe('utils', () => {
  it('esc escapes html', () => {
    expect(esc('<script>alert("x")</script>')).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(esc(null)).toBe('');
  });
  it('matchPct clamps', () => {
    expect(matchPct(8.5)).toBe(85);
    expect(matchPct(10)).toBe(99);
    expect(matchPct(0)).toBe(0);
  });
  it('yearOf extracts year', () => {
    expect(yearOf({ release_date: '2023-05-01' })).toBe('2023');
    expect(yearOf({ first_air_date: '2020-01-15' })).toBe('2020');
    expect(yearOf({})).toBe('');
  });
  it('titleOf fallback', () => {
    expect(titleOf({ title: 'A' })).toBe('A');
    expect(titleOf({ name: 'B' })).toBe('B');
    expect(titleOf({})).toBe('Untitled');
  });
  it('mediaTypeOf detects', () => {
    expect(mediaTypeOf({ media_type: 'tv' })).toBe('tv');
    expect(mediaTypeOf({ media_type: 'movie' })).toBe('movie');
    expect(mediaTypeOf({ name: 'show', first_air_date: '2020' })).toBe('tv');
    expect(mediaTypeOf({ title: 'film' })).toBe('movie');
  });
  it('clamp', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});
