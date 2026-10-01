import { describe, expect, it } from 'vitest';
import { emptyLock, LockEntry, parseLock, powerStatus, serializeLock, withEntry, withoutEntry } from '../../../src/powers/lock';

const entry = (version = '1.0.0'): LockEntry => ({
  version,
  skillName: 'alpha',
  sha256: 'a'.repeat(64),
  files: ['SKILL.md'],
  installedAt: '2026-10-01T00:00:00.000Z',
});

describe('lockfile', () => {
  it('sin archivo o vacío es un lock vacío', () => {
    expect(parseLock(undefined)).toEqual(emptyLock());
    expect(parseLock('  ')).toEqual(emptyLock());
  });
  it('JSON inválido o formato desconocido lanza', () => {
    expect(() => parseLock('{')).toThrow(/no es JSON válido/);
    expect(() => parseLock('{"schemaVersion":2,"powers":{}}')).toThrow(/formato esperado/);
  });
  it('rechaza entradas con rutas peligrosas', () => {
    const text = JSON.stringify({ schemaVersion: 1, powers: { alpha: { ...entry(), files: ['../x'] } } });
    expect(() => parseLock(text)).toThrow(/"alpha" no es válida/);
  });
  it('serializa con claves ordenadas y salto final, y vuelve a leerse igual', () => {
    const lock = withEntry(withEntry(emptyLock(), 'zeta', { ...entry(), skillName: 'zeta' }), 'alpha', entry());
    const text = serializeLock(lock);
    expect(text.indexOf('"alpha"')).toBeLessThan(text.indexOf('"zeta"'));
    expect(text.endsWith('\n')).toBe(true);
    expect(parseLock(text)).toEqual(lock);
  });
  it('withEntry/withoutEntry no mutan', () => {
    const a = emptyLock();
    const b = withEntry(a, 'alpha', entry());
    expect(a.powers).toEqual({});
    expect(withoutEntry(b, 'alpha').powers).toEqual({});
    expect(b.powers.alpha).toBeDefined();
  });
  it('powerStatus', () => {
    expect(powerStatus({ version: '1.0.0' }, undefined)).toBe('available');
    expect(powerStatus({ version: '1.0.0' }, entry('1.0.0'))).toBe('active');
    expect(powerStatus({ version: '1.1.0' }, entry('1.0.0'))).toBe('update');
  });
});
