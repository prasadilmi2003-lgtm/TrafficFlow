import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from 'vitest';
import { readCookie } from '../src/utils/http.js';

const withCookie = (cookie?: string) => ({ headers: cookie === undefined ? {} : { cookie } }) as IncomingMessage;

describe('readCookie', () => {
  it('finds a cookie among several', () => {
    expect(readCookie(withCookie('theme=dark; tf_session=abc.def.ghi; lang=en'), 'tf_session')).toBe('abc.def.ghi');
  });

  it('returns undefined when the cookie or the header is missing', () => {
    expect(readCookie(withCookie('theme=dark'), 'tf_session')).toBeUndefined();
    expect(readCookie(withCookie(), 'tf_session')).toBeUndefined();
  });

  it('does not match cookies whose names only start the same way', () => {
    expect(readCookie(withCookie('tf_session_old=1'), 'tf_session')).toBeUndefined();
  });
});
