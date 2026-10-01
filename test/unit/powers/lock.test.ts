import { describe, expect, it } from 'vitest';
import {
  emptyLock,
  inputsInUse,
  LockEntry,
  mcpFileCreatedByUs,
  parseLock,
  powerStatus,
  serializeLock,
  withEntry,
  withoutEntry,
} from '../../../src/powers/lock';

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
    expect(() => parseLock('{"schemaVersion":3,"powers":{}}')).toThrow(/formato esperado/);
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
  describe('v2 (MCP)', () => {
    const mcpEntry = (over: Partial<NonNullable<LockEntry['mcp']>> = {}): LockEntry => ({
      ...entry(),
      skillName: 'aws',
      mcp: { mode: 'readOnly', servers: { 'sdd-aws': 'b'.repeat(64) }, inputs: ['sdd_aws_profile', 'sdd_aws_region'], createdFile: false, ...over },
    });

    it('lee el v1 de siempre', () => {
      const text = JSON.stringify({ schemaVersion: 1, powers: { alpha: entry() } });
      expect(parseLock(text)).toEqual({ schemaVersion: 1, powers: { alpha: entry() } });
    });
    it('lee y reescribe igual un v2 con mcp', () => {
      const lock = withEntry(withEntry(emptyLock(), 'alpha', entry()), 'aws', mcpEntry({ mode: 'operate', createdFile: true }));
      const text = serializeLock(lock);
      expect(JSON.parse(text).schemaVersion).toBe(2);
      expect(parseLock(text)).toEqual(lock);
    });
    it('escribe v1 si no hay MCP y v2 si lo hay', () => {
      const plain = withEntry(emptyLock(), 'alpha', entry());
      expect(JSON.parse(serializeLock(plain)).schemaVersion).toBe(1);
      const withMcp = withEntry(plain, 'aws', mcpEntry());
      expect(JSON.parse(serializeLock(withMcp)).schemaVersion).toBe(2);
      expect(JSON.parse(serializeLock(withoutEntry(withMcp, 'aws'))).schemaVersion).toBe(1);
    });
    it('rechaza mcp en un lock v1 y mcp mal formado', () => {
      expect(() => parseLock(JSON.stringify({ schemaVersion: 1, powers: { aws: mcpEntry() } }))).toThrow(/"aws" no es válida/);
      for (const bad of [{ mode: 'admin' }, { servers: { github: 'b'.repeat(64) } }, { servers: { 'sdd-aws': 'corto' } }, { inputs: ['AWS'] }, { createdFile: 'no' }]) {
        const text = JSON.stringify({ schemaVersion: 2, powers: { aws: mcpEntry(bad as never) } });
        expect(() => parseLock(text), JSON.stringify(bad)).toThrow(/"aws" no es válida/);
      }
    });
    it('inputsInUse y mcpFileCreatedByUs ignoran el Power indicado', () => {
      const lock = withEntry(withEntry(emptyLock(), 'aws', mcpEntry({ createdFile: true })), 'aws-docs', mcpEntry({ inputs: ['sdd_aws_region'], servers: { 'sdd-awsdocs': 'c'.repeat(64) } }));
      expect([...inputsInUse(lock, 'aws')]).toEqual(['sdd_aws_region']);
      expect([...inputsInUse(lock, 'aws-docs')].sort()).toEqual(['sdd_aws_profile', 'sdd_aws_region']);
      expect(mcpFileCreatedByUs(lock, 'aws-docs')).toBe(true);
      expect(mcpFileCreatedByUs(lock, 'aws')).toBe(false);
    });
  });
});
