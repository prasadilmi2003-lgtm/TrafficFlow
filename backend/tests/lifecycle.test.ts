import { describe, expect, it } from 'vitest';
import { assertTransition, canTransition, nextStatuses } from '../src/modules/incidents/lifecycle.js';
import { INCIDENT_STATUSES, type IncidentStatus, type Role } from '../src/types/domain.js';
import { AppError } from '../src/utils/AppError.js';

function errorFrom(action: () => void): AppError {
  try {
    action();
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error('Expected an AppError');
}

describe('incident lifecycle', () => {
  it.each([
    ['REPORTED', 'VERIFIED', 'OPERATOR'],
    ['REPORTED', 'REJECTED', 'OPERATOR'],
    ['VERIFIED', 'ASSIGNED', 'OPERATOR'],
    ['ASSIGNED', 'RESPONDING', 'RESPONDER'],
    ['RESPONDING', 'RESOLVED', 'RESPONDER'],
    ['RESPONDING', 'RESOLVED', 'OPERATOR'],
  ] as Array<[IncidentStatus, IncidentStatus, Role]>)('allows %s → %s by %s', (from, to, role) => {
    expect(canTransition(from, to, role)).toBe(true);
    expect(() => assertTransition(from, to, role)).not.toThrow();
  });

  it('follows the agreed order REPORTED → VERIFIED → ASSIGNED → RESPONDING → RESOLVED', () => {
    expect(nextStatuses('REPORTED')).toEqual(['VERIFIED', 'REJECTED']);
    expect(nextStatuses('VERIFIED')).toEqual(['ASSIGNED']);
    expect(nextStatuses('ASSIGNED')).toEqual(['RESPONDING']);
    expect(nextStatuses('RESPONDING')).toEqual(['RESOLVED']);
  });

  it('treats REJECTED and RESOLVED as final', () => {
    for (const status of INCIDENT_STATUSES) {
      expect(canTransition('REJECTED', status, 'OPERATOR')).toBe(false);
      expect(canTransition('RESOLVED', status, 'OPERATOR')).toBe(false);
    }
  });

  it('refuses to skip steps with 409 INVALID_STATUS_TRANSITION', () => {
    const error = errorFrom(() => assertTransition('REPORTED', 'RESOLVED', 'OPERATOR'));

    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('INVALID_STATUS_TRANSITION');
    expect(error.details).toEqual({ from: 'REPORTED', to: 'RESOLVED', allowed: ['VERIFIED', 'REJECTED'] });
  });

  it('never moves backwards', () => {
    expect(canTransition('ASSIGNED', 'VERIFIED', 'OPERATOR')).toBe(false);
    expect(canTransition('RESPONDING', 'ASSIGNED', 'OPERATOR')).toBe(false);
    expect(canTransition('RESOLVED', 'RESPONDING', 'RESPONDER')).toBe(false);
  });

  it('refuses the right change by the wrong role with 403 TRANSITION_NOT_ALLOWED', () => {
    const citizenVerifies = errorFrom(() => assertTransition('REPORTED', 'VERIFIED', 'CITIZEN'));
    const operatorResponds = errorFrom(() => assertTransition('ASSIGNED', 'RESPONDING', 'OPERATOR'));
    const adminResolves = errorFrom(() => assertTransition('RESPONDING', 'RESOLVED', 'ADMIN'));

    for (const error of [citizenVerifies, operatorResponds, adminResolves]) {
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('TRANSITION_NOT_ALLOWED');
    }
  });
});
