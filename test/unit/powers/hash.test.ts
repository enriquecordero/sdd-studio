import { describe, expect, it } from 'vitest';
import { powerHash } from '../../../src/powers/hash';

describe('powerHash', () => {
  it('no depende del orden de las claves', () => {
    expect(powerHash({ 'a.md': '1', 'b.md': '2' })).toBe(powerHash({ 'b.md': '2', 'a.md': '1' }));
  });
  it('cambia si cambia el contenido o la ruta', () => {
    const base = powerHash({ 'a.md': '1' });
    expect(powerHash({ 'a.md': '2' })).not.toBe(base);
    expect(powerHash({ 'b.md': '1' })).not.toBe(base);
  });
  it('separa ruta y contenido (sin ambigüedad)', () => {
    expect(powerHash({ a: 'bc' })).not.toBe(powerHash({ ab: 'c' }));
  });
  it('es hex de 64 caracteres', () => {
    expect(powerHash({ 'SKILL.md': 'x' })).toMatch(/^[a-f0-9]{64}$/);
  });
});
