import { describe, expect, it } from 'vitest';
import {
  frontMatterFields,
  prepareSpecDocContent,
  readFrontMatter,
  setFrontMatterFields,
} from '../../../src/specs/frontMatter';

describe('readFrontMatter', () => {
  it('sin front matter es draft', () => {
    expect(readFrontMatter('# Hola\n')).toEqual({ status: 'draft' });
  });
  it('lee approved y approvedAt', () => {
    const text = '---\nstatus: approved\napprovedAt: 2026-10-01T10:00:00.000Z\n---\n# Doc\n';
    expect(readFrontMatter(text)).toEqual({ status: 'approved', approvedAt: '2026-10-01T10:00:00.000Z' });
  });
  it('un status desconocido cuenta como draft', () => {
    expect(readFrontMatter('---\nstatus: listo\n---\nx\n').status).toBe('draft');
  });
  it('acepta CRLF', () => {
    expect(readFrontMatter('---\r\nstatus: approved\r\n---\r\nx\r\n').status).toBe('approved');
  });
});

describe('frontMatterFields', () => {
  it('devuelve todas las claves', () => {
    const fields = frontMatterFields('---\napplyTo: "**/*.ts"\ndescription: Tech\n---\nbody');
    expect(fields.get('applyTo')).toBe('"**/*.ts"');
    expect(fields.get('description')).toBe('Tech');
  });
});

describe('setFrontMatterFields', () => {
  it('añade front matter a un documento sin él y conserva el cuerpo exacto', () => {
    expect(setFrontMatterFields('# Título\n\ntexto\n', { status: 'draft' })).toBe(
      '---\nstatus: draft\n---\n# Título\n\ntexto\n',
    );
  });
  it('reemplaza claves, conserva desconocidas y elimina las undefined', () => {
    const text = '---\nstatus: approved\nowner: ana\napprovedAt: 2026-01-01\n---\nbody\n';
    expect(setFrontMatterFields(text, { status: 'draft', approvedAt: undefined })).toBe(
      '---\nstatus: draft\nowner: ana\n---\nbody\n',
    );
  });
  it('mantiene CRLF', () => {
    const text = '---\r\nstatus: draft\r\n---\r\nbody\r\n';
    expect(setFrontMatterFields(text, { status: 'approved' })).toBe('---\r\nstatus: approved\r\n---\r\nbody\r\n');
  });
});

describe('prepareSpecDocContent', () => {
  it('quita un bloque ```markdown que envuelve todo', () => {
    expect(prepareSpecDocContent('```markdown\n# Requisitos\n\nx\n```')).toBe('# Requisitos\n\nx\n');
  });
  it('quita el front matter que traiga el agente', () => {
    expect(prepareSpecDocContent('---\nstatus: approved\n---\n\n# Diseño\n')).toBe('# Diseño\n');
  });
  it('quita ambos a la vez y añade salto final', () => {
    expect(prepareSpecDocContent('```md\n---\nstatus: approved\n---\n# Tareas\n```')).toBe('# Tareas\n');
  });
  it('no toca bloques de código internos', () => {
    const doc = '# Diseño\n\n```ts\nconst a = 1;\n```\n';
    expect(prepareSpecDocContent(doc)).toBe(doc);
  });
});

describe('delimitador de cierre (M1)', () => {
  it('un --- a mitad de línea no cierra el front matter', () => {
    const text = '---\nnotes: a---\nstatus: approved\n---\n# Doc\n';
    expect(readFrontMatter(text).status).toBe('approved');
    expect(frontMatterFields(text).get('notes')).toBe('a---');
    expect(setFrontMatterFields(text, { status: 'draft' })).toBe('---\nnotes: a---\nstatus: draft\n---\n# Doc\n');
  });
  it('front matter vacío', () => {
    expect(setFrontMatterFields('---\n---\n# Doc\n', { status: 'draft' })).toBe('---\nstatus: draft\n---\n# Doc\n');
  });
  it('CRLF con front matter vacío y con campos', () => {
    expect(setFrontMatterFields('---\r\n---\r\nx\r\n', { status: 'draft' })).toBe('---\r\nstatus: draft\r\n---\r\nx\r\n');
    expect(readFrontMatter('---\r\nnotes: a---\r\nstatus: approved\r\n---\r\nx\r\n').status).toBe('approved');
  });
  it('un cuerpo que empieza con una regla horizontal sin cierre no es front matter', () => {
    expect(prepareSpecDocContent('---\n# Diseño\n\ntexto\n')).toBe('---\n# Diseño\n\ntexto\n');
    expect(readFrontMatter('---\n# Diseño\n').status).toBe('draft');
  });
  it('acepta espacios tras el --- de cierre y fin de archivo', () => {
    expect(readFrontMatter('---\nstatus: approved\n---  ').status).toBe('approved');
  });
});
