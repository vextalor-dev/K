import { describe, it, expect } from 'vitest';
import { normalizeApiPath, apiPathFromUrl } from '../api/_lib/tmdb.js';

describe('tmdb proxy paths', () => {
  it('normalizeApiPath rejects traversal', () => {
    expect(normalizeApiPath('../etc')).toBeNull();
    expect(normalizeApiPath('movie/../tv')).toBeNull();
    expect(normalizeApiPath('')).toBeNull();
    expect(normalizeApiPath('a'.repeat(201))).toBeNull();
  });
  it('normalizeApiPath accepts valid', () => {
    expect(normalizeApiPath('trending/movie/day')).toBe('trending/movie/day');
    expect(normalizeApiPath('/movie/popular/')).toBe('movie/popular');
  });
  it('apiPathFromUrl strips prefix', () => {
    expect(apiPathFromUrl('/api/tmdb/trending/movie/day?language=en-US')).toBe('trending/movie/day');
    expect(apiPathFromUrl('/trending/tv/week')).toBe('trending/tv/week');
    expect(apiPathFromUrl('/api/tmdb/')).toBeNull();
  });
});
