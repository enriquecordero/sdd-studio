import { describe, expect, it } from 'vitest';
import { isValidSpecName, toSpecName } from '../../../src/specs/names';

describe('isValidSpecName', () => {
  it.each(['export-csv', 'a', 'login-sso-2'])('%s es válido', (n) => expect(isValidSpecName(n)).toBe(true));
  it.each(['', 'Export', 'a--b', '-a', 'a-', 'a b', 'ñandú', 'x'.repeat(65)])('"%s" es inválido', (n) =>
    expect(isValidSpecName(n)).toBe(false),
  );
});

describe('toSpecName', () => {
  it('quita acentos, espacios y mayúsculas', () => {
    expect(toSpecName('Exportación CSV')).toBe('exportacion-csv');
  });
  it('colapsa símbolos y recorta guiones', () => {
    expect(toSpecName('  ¡Login / SSO!  ')).toBe('login-sso');
  });
  it('limita a 64 caracteres sin guion final', () => {
    const name = toSpecName('a'.repeat(63) + ' b');
    expect(name.length).toBeLessThanOrEqual(64);
    expect(isValidSpecName(name)).toBe(true);
  });
  it('devuelve vacío si no queda nada', () => {
    expect(toSpecName('¿¿??')).toBe('');
  });
});
