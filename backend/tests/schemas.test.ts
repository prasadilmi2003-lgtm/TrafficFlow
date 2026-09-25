import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from '../src/modules/auth/auth.schemas.js';
import { addNoteSchema, createIncidentSchema, listIncidentsQuerySchema } from '../src/modules/incidents/incidents.schemas.js';
import { createUserSchema } from '../src/modules/users/users.schemas.js';

const TYPE_ID = '5f0c6a3e-8f7b-4c2d-9a1e-3b4c5d6e7f80';

describe('registerSchema', () => {
  const valid = { fullName: ' Ayesha Fernando ', email: ' Ayesha@Example.COM ', password: 'secret123' };

  it('trims the name and normalises the email to lower case', () => {
    expect(registerSchema.parse(valid)).toEqual({
      fullName: 'Ayesha Fernando',
      email: 'ayesha@example.com',
      phone: null,
      password: 'secret123',
    });
  });

  it('rejects weak passwords', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'short1' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, password: 'onlyletters' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, password: '12345678' }).success).toBe(false);
  });

  it('rejects passwords longer than bcrypt can use (72 bytes)', () => {
    expect(registerSchema.safeParse({ ...valid, password: `a1${'x'.repeat(71)}` }).success).toBe(false);
  });

  it('ignores a role sent by the client (registration always creates a citizen)', () => {
    const parsed = registerSchema.parse({ ...valid, role: 'ADMIN' });
    expect('role' in parsed).toBe(false);
  });
});

describe('createIncidentSchema', () => {
  it('converts form fields (all strings in multipart forms) to numbers', () => {
    const parsed = createIncidentSchema.parse({
      incidentTypeId: TYPE_ID,
      description: '  Two cars collided near the junction  ',
      latitude: '6.9271',
      longitude: '79.8612',
      locationText: '',
    });

    expect(parsed).toEqual({
      incidentTypeId: TYPE_ID,
      description: 'Two cars collided near the junction',
      latitude: 6.9271,
      longitude: 79.8612,
      locationText: null,
    });
  });

  it('rejects coordinates outside the valid range and short descriptions', () => {
    const base = { incidentTypeId: TYPE_ID, description: 'A long enough description', latitude: '6.9', longitude: '79.8' };
    expect(createIncidentSchema.safeParse({ ...base, latitude: '91' }).success).toBe(false);
    expect(createIncidentSchema.safeParse({ ...base, longitude: '-181' }).success).toBe(false);
    expect(createIncidentSchema.safeParse({ ...base, description: 'too short' }).success).toBe(false);
  });

  it('accepts an optional severity from the citizen; an empty field means "not sure"', () => {
    const base = { incidentTypeId: TYPE_ID, description: 'A long enough description', latitude: '6.9', longitude: '79.8' };
    expect(createIncidentSchema.parse({ ...base, severity: 'HIGH' }).severity).toBe('HIGH');
    expect(createIncidentSchema.parse({ ...base, severity: '' }).severity).toBeUndefined();
    expect(createIncidentSchema.parse(base).severity).toBeUndefined();
    expect(createIncidentSchema.safeParse({ ...base, severity: 'EXTREME' }).success).toBe(false);
  });
});

describe('addNoteSchema', () => {
  it('trims the note and rejects empty or very long notes', () => {
    expect(addNoteSchema.parse({ note: '  Arrived on scene  ' })).toEqual({ note: 'Arrived on scene' });
    expect(addNoteSchema.safeParse({ note: '   ' }).success).toBe(false);
    expect(addNoteSchema.safeParse({ note: 'x'.repeat(1001) }).success).toBe(false);
  });
});

describe('listIncidentsQuerySchema', () => {
  it('accepts repeated and comma-separated status filters', () => {
    expect(listIncidentsQuerySchema.parse({ status: ['REPORTED', 'VERIFIED'] }).status).toEqual(['REPORTED', 'VERIFIED']);
    expect(listIncidentsQuerySchema.parse({ status: 'ASSIGNED,RESPONDING' }).status).toEqual(['ASSIGNED', 'RESPONDING']);
  });

  it('applies paging defaults and rejects unknown statuses', () => {
    expect(listIncidentsQuerySchema.parse({})).toMatchObject({ page: 1, limit: 20 });
    expect(listIncidentsQuerySchema.safeParse({ status: 'DONE' }).success).toBe(false);
    expect(listIncidentsQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });
});

describe('createUserSchema', () => {
  const base = { fullName: 'Kamal Silva', email: 'kamal@example.com', password: 'secret123' };

  it('requires a responder profile for responders', () => {
    expect(createUserSchema.safeParse({ ...base, role: 'RESPONDER' }).success).toBe(false);
    expect(
      createUserSchema.safeParse({
        ...base,
        role: 'RESPONDER',
        responderProfile: { responderType: 'POLICE', unitCode: 'pol-01' },
      }).data?.responderProfile,
    ).toEqual({ responderType: 'POLICE', unitCode: 'POL-01' });
  });

  it('does not need a profile for other roles', () => {
    expect(createUserSchema.safeParse({ ...base, role: 'OPERATOR' }).success).toBe(true);
  });
});

describe('loginSchema', () => {
  it('normalises the email so login is not case-sensitive', () => {
    expect(loginSchema.parse({ email: ' Ayesha@Example.COM ', password: 'secret123' })).toEqual({
      email: 'ayesha@example.com',
      password: 'secret123',
    });
  });

  it('requires both fields', () => {
    expect(loginSchema.safeParse({ email: '', password: 'secret123' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.com' }).success).toBe(false);
  });
});
