import { parse } from 'jsonc-parser';
import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../../../src/powers/hash';
import { addEntries, entryHash, isEmptyMcpFile, McpJsonError, readEntries, readInputIds, removeEntries } from '../../../src/powers/mcp/mcpJson';
import type { McpInput, McpServer } from '../../../src/powers/mcp/spec';

const c7: Record<string, McpServer> = { 'sdd-context7': { type: 'http', url: 'https://mcp.context7.com/mcp' } };
const aws: Record<string, McpServer> = {
  'sdd-aws': { type: 'stdio', command: 'uvx', args: ['awslabs.aws-api-mcp-server@1.5.6'], env: { AWS_REGION: '${input:sdd_aws_region}' } },
};
const region: McpInput = { id: 'sdd_aws_region', type: 'promptString', description: 'Región AWS', default: 'us-east-1' };
const FOREIGN = `{
  // servidores del equipo
  "servers": {
    "mine": { "type": "stdio", "command": "my-server" }, // no tocar
  },
  "inputs": [
    { "id": "my_token", "type": "promptString", "description": "Token", "password": true }
  ]
}
`;

describe('mcpJson', () => {
  it('añade a un archivo inexistente o vacío', () => {
    for (const text of [undefined, '', '  \n']) {
      const out = addEntries(text, c7, []);
      expect(parse(out)).toEqual({ servers: c7 });
      expect(out.endsWith('\n')).toBe(true);
    }
  });

  it('añade conservando comentarios, servidores e inputs ajenos', () => {
    const out = addEntries(FOREIGN, aws, [region]);
    expect(out).toContain('// servidores del equipo');
    expect(out).toContain('// no tocar');
    const json = parse(out);
    expect(json.servers.mine).toEqual({ type: 'stdio', command: 'my-server' });
    expect(json.servers['sdd-aws']).toEqual(aws['sdd-aws']);
    expect(readInputIds(out)).toEqual(['my_token', 'sdd_aws_region']);
  });

  it('no duplica inputs que ya están y crea "inputs" si falta', () => {
    const once = addEntries('{ "servers": {} }', aws, [region]);
    const twice = addEntries(once, aws, [region]);
    expect(readInputIds(twice)).toEqual(['sdd_aws_region']);
    expect(parse(twice).servers).toEqual(aws);
  });

  it('reemplaza una entrada existente con el mismo nombre', () => {
    const before = addEntries(undefined, c7, []);
    const other = { 'sdd-context7': { type: 'http' as const, url: 'https://example.com/mcp' } };
    expect(parse(addEntries(before, other, [])).servers).toEqual(other);
  });

  it('quita solo lo pedido y deja "servers": {} si no queda nada', () => {
    const full = addEntries(FOREIGN, { ...aws, ...c7 }, [region]);
    const out = removeEntries(full, ['sdd-aws', 'sdd-context7'], ['sdd_aws_region']);
    expect(out).toContain('// no tocar');
    expect(parse(out).servers).toEqual({ mine: { type: 'stdio', command: 'my-server' } });
    expect(readInputIds(out)).toEqual(['my_token']);
    const alone = removeEntries(addEntries(undefined, c7, []), ['sdd-context7'], []);
    expect(parse(alone)).toEqual({ servers: {} });
    expect(isEmptyMcpFile(alone)).toBe(true);
    expect(isEmptyMcpFile(out)).toBe(false);
  });

  it('deja byte a byte las entradas ajenas y los comentarios al añadir y al retirar', () => {
    const MESSY = `{
  // equipo
  "servers": {
    "mine": { "type": "stdio", "command": "my-server" }, // no tocar
    /* otro */ "other":{"type":"http","url":"https://x.dev"},
  },
  "inputs": [
    { "id": "my_token", "type": "promptString", "description": "Token", "password": true },
  ],
}
`;
    const foreign = ['    "mine": { "type": "stdio", "command": "my-server" },', '/* otro */ "other":{"type":"http","url":"https://x.dev"},', '{ "id": "my_token", "type": "promptString", "description": "Token", "password": true },', '// equipo'];
    const added = addEntries(MESSY, { ...aws, ...c7 }, [region]);
    for (const piece of foreign) expect(added, piece).toContain(piece);
    expect(added).toContain('// no tocar');
    const removed = removeEntries(added, ['sdd-aws', 'sdd-context7'], ['sdd_aws_region']);
    for (const piece of foreign) expect(removed, piece).toContain(piece);
    expect(removed).toBe(MESSY);
  });

  it('add y remove sobre un archivo con solo entradas ajenas deja el texto idéntico', () => {
    const only = '{\n  "servers": {\n    "mine": { "type": "stdio", "command": "my-server" }\n  }\n}\n';
    const out = removeEntries(addEntries(only, c7, []), ['sdd-context7'], []);
    expect(out).toBe(only);
  });

  it('retirar quita el "inputs" que vació, pero respeta uno ya vacío o con inputs ajenos', () => {
    const ours = addEntries(undefined, aws, [region]);
    const emptied = removeEntries(ours, ['sdd-aws'], ['sdd_aws_region']);
    expect(parse(emptied)).toEqual({ servers: {} });
    const preEmpty = '{ "servers": {}, "inputs": [] }';
    expect(parse(removeEntries(preEmpty, [], ['sdd_aws_region']))).toEqual({ servers: {}, inputs: [] });
    const withForeign = removeEntries(addEntries(FOREIGN, aws, [region]), ['sdd-aws'], ['sdd_aws_region']);
    expect(readInputIds(withForeign)).toEqual(['my_token']);
  });

  it('add y remove devuelven FOREIGN idéntico', () => {
    expect(removeEntries(addEntries(FOREIGN, { ...aws, ...c7 }, [region]), ['sdd-aws', 'sdd-context7'], ['sdd_aws_region'])).toBe(FOREIGN);
  });

  describe('removeEntries conserva comentarios y validez en archivos ya existentes', () => {
    const ours = '"sdd-context7": { "type": "http", "url": "https://mcp.context7.com/mcp" }';
    const mine = '"mine": { "type": "stdio", "command": "my-server" }';
    const remove = (text: string): string => removeEntries(text, ['sdd-context7'], []);

    it('(a) el nuestro va primero y le sigue una entrada ajena con comentario', () => {
      const out = remove(`{\n  "servers": {\n    ${ours},\n    // mi servidor\n    ${mine}\n  }\n}\n`);
      expect(out).toBe(`{\n  "servers": {\n    // mi servidor\n    ${mine}\n  }\n}\n`);
      expect(parse(out).servers).toEqual({ mine: { type: 'stdio', command: 'my-server' } });
    });

    it('(b) la entrada ajena anterior tiene un comentario al final', () => {
      const out = remove(`{\n  "servers": {\n    ${mine}, // no tocar\n    ${ours}\n  }\n}\n`);
      expect(out).toContain('// no tocar');
      expect(parse(out).servers).toEqual({ mine: { type: 'stdio', command: 'my-server' } });
    });

    it('(c) el nuestro es el único y el archivo usa coma final', () => {
      const out = remove(`{\n  "servers": {\n    ${ours},\n  },\n}\n`);
      expect(parse(out)).toEqual({ servers: {} });
      expect(isEmptyMcpFile(out)).toBe(true);
    });

    it('(g) el nuestro es el único y tiene un comentario ajeno encima', () => {
      for (const comma of ['', ',']) {
        const out = remove(`{\n  "servers": {\n    // aviso\n    ${ours}${comma}\n  }\n}\n`);
        expect(out).toContain('// aviso');
        expect(parse(out)).toEqual({ servers: {} });
      }
    });
  });

  it('readEntries devuelve solo las presentes', () => {
    const text = addEntries(FOREIGN, c7, []);
    expect(readEntries(text, ['sdd-context7', 'sdd-aws'])).toEqual(c7);
    expect(readEntries(undefined, ['sdd-context7'])).toEqual({});
  });

  it('readEntries ve una entrada ajena con el mismo nombre', () => {
    const theirs = '{ "servers": { "sdd-context7": { "type": "http", "url": "https://otro.dev/mcp" } } }';
    expect(Object.keys(readEntries(theirs, ['sdd-context7']))).toEqual(['sdd-context7']);
  });

  it('JSONC inválido o con forma inesperada lanza McpJsonError', () => {
    for (const bad of ['{ roto', '[]', '{ "servers": [] }', '{ "inputs": {} }']) {
      expect(() => readEntries(bad, []), bad).toThrow(McpJsonError);
      expect(() => addEntries(bad, c7, []), bad).toThrow(McpJsonError);
    }
    expect(() => readEntries('{ roto', [])).toThrow(/no es JSONC válido/);
  });

  it('entryHash es estable aunque cambie el orden de las claves', () => {
    const a = { type: 'stdio', command: 'uvx', env: { B: '2', A: '1' }, args: ['x@1.0.0'] };
    const b = { args: ['x@1.0.0'], env: { A: '1', B: '2' }, command: 'uvx', type: 'stdio' };
    expect(entryHash(a)).toBe(entryHash(b));
    expect(entryHash(a)).toMatch(/^[a-f0-9]{64}$/);
    expect(entryHash({ ...a, command: 'npx' })).not.toBe(entryHash(a));
  });

  it('canonicalJson ordena claves a cualquier profundidad e ignora undefined', () => {
    expect(canonicalJson({ b: [{ z: 1, a: 2 }], a: undefined, c: 'x' })).toBe('{"b":[{"a":2,"z":1}],"c":"x"}');
  });
});
