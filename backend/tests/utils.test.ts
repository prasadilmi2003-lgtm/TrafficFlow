import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from 'vitest';
import { readCookie } from '../src/utils/http.js';
import { imageTypeOf } from '../src/utils/imageType.js';
import { escapeLike, paginated } from '../src/utils/pagination.js';

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

describe('imageTypeOf', () => {
  it('recognises JPEG, PNG and WebP from their first bytes', () => {
    expect(imageTypeOf(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
    expect(imageTypeOf(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png');
    expect(imageTypeOf(Buffer.from('RIFF\u0000\u0000\u0000\u0000WEBP', 'latin1'))).toBe('webp');
  });

  it('rejects anything else, such as a script renamed to .jpg', () => {
    expect(imageTypeOf(Buffer.from('<script>alert(1)</script>'))).toBeUndefined();
    expect(imageTypeOf(Buffer.from([]))).toBeUndefined();
  });
});

describe('pagination helpers', () => {
  it('escapes LIKE wildcards so searches match literally', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });

  it('calculates the number of pages', () => {
    expect(paginated(['a'], 41, { page: 2, limit: 20 }).pagination).toEqual({
      page: 2,
      limit: 20,
      total: 41,
      totalPages: 3,
    });
    expect(paginated([], 0, { page: 1, limit: 20 }).pagination.totalPages).toBe(1);
  });
});
