import { describe, expect, it } from 'vitest';
import { formatDateTime } from './format';

describe('formatDateTime', () => {
  it('shows a dash when there is no date', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
  });

  it('formats an ISO date for display, including the year', () => {
    expect(formatDateTime('2026-09-25T09:15:00Z')).toMatch(/2026/);
  });
});
