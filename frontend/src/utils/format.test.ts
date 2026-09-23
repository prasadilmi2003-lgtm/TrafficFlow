import { describe, expect, it } from 'vitest';
import { directionsUrl, formatDuration, timeAgo } from './format';
import { homePathForRole } from './labels';

describe('timeAgo', () => {
  const now = new Date('2026-09-23T12:00:00Z').getTime();

  it('describes recent times in words', () => {
    expect(timeAgo('2026-09-23T11:59:30Z', now)).toBe('just now');
    expect(timeAgo('2026-09-23T11:55:00Z', now)).toBe('5 min ago');
    expect(timeAgo('2026-09-23T09:00:00Z', now)).toBe('3 h ago');
    expect(timeAgo('2026-09-22T12:00:00Z', now)).toBe('1 day ago');
    expect(timeAgo('2026-09-20T12:00:00Z', now)).toBe('3 days ago');
  });

  it('never shows negative times for clocks that are slightly ahead', () => {
    expect(timeAgo('2026-09-23T12:00:10Z', now)).toBe('just now');
  });
});

describe('formatDuration', () => {
  it('formats minutes, hours and days', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(120)).toBe('2 h');
    expect(formatDuration(125)).toBe('2 h 5 min');
    expect(formatDuration(1500)).toBe('1 d 1 h');
    expect(formatDuration(null)).toBe('—');
  });
});

describe('homePathForRole', () => {
  it('sends each role to its own portal', () => {
    expect(homePathForRole('CITIZEN')).toBe('/citizen');
    expect(homePathForRole('OPERATOR')).toBe('/operator');
    expect(homePathForRole('RESPONDER')).toBe('/responder');
    expect(homePathForRole('ADMIN')).toBe('/admin');
  });
});

describe('directionsUrl', () => {
  it('points navigation apps at the incident', () => {
    expect(directionsUrl(6.9271, 79.8612)).toBe('https://www.google.com/maps/dir/?api=1&destination=6.9271,79.8612');
  });
});
