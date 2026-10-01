import { describe, expect, it } from 'vitest';
import { resolveSpecFolder } from '../../../src/workspace/resolve';

const a = { name: 'api', hasSpec: false };
const b = { name: 'web', hasSpec: false };

describe('resolveSpecFolder', () => {
  it('sin carpetas: error', () => {
    expect(resolveSpecFolder([], 'x', undefined, false)).toMatchObject({ ok: false });
  });
  it('una carpeta: esa', () => {
    expect(resolveSpecFolder([a], 'x', undefined, false)).toEqual({ ok: true, folder: 'api' });
  });
  it('folder pedido inexistente: error que lista carpetas', () => {
    const r = resolveSpecFolder([a, b], 'x', 'mobile', false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('api, web');
  });
  it('mismo spec en dos carpetas sin folder: error que nombra ambas', () => {
    const r = resolveSpecFolder([{ ...a, hasSpec: true }, { ...b, hasSpec: true }], 'export-csv', undefined, true);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/export-csv.*api, web.*folder/);
  });
  it('spec en una sola carpeta: esa', () => {
    expect(resolveSpecFolder([a, { ...b, hasSpec: true }], 'x', undefined, true)).toEqual({ ok: true, folder: 'web' });
  });
  it('spec nuevo en multi-root sin folder: error', () => {
    expect(resolveSpecFolder([a, b], 'x', undefined, false).ok).toBe(false);
  });
  it('mustExist y no existe: error', () => {
    expect(resolveSpecFolder([a], 'x', undefined, true).ok).toBe(false);
    expect(resolveSpecFolder([a], 'x', 'api', true).ok).toBe(false);
  });
});
