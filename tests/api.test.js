import { describe, it, expect, beforeEach } from 'vitest';
import { getLocalApiKey, setLocalApiKey } from '../public/js/api.js';

describe('api key management', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('gets default key when no custom key set', () => {
    expect(getLocalApiKey()).toBe('7f1744eb03153962f13f178d89036a40');
  });

  it('sets and gets custom api key', () => {
    setLocalApiKey('custom_tmdb_key_123');
    expect(getLocalApiKey()).toBe('custom_tmdb_key_123');
  });

  it('falls back to default key when cleared', () => {
    setLocalApiKey('custom_key');
    expect(getLocalApiKey()).toBe('custom_key');
    setLocalApiKey('');
    expect(getLocalApiKey()).toBe('7f1744eb03153962f13f178d89036a40');
  });
});
