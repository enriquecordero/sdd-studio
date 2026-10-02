import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { delimiter, join } from 'path';
import { describe, expect, it } from 'vitest';
import { isIgnoredBy } from '../../../src/powers/mcp/gitignore';
import { mcpPolicyState, strictBlocksMcp } from '../../../src/powers/mcp/policy';
import { findOnPath } from '../../../src/powers/mcp/prereqs';

describe('mcpPolicyState', () => {
  it('allowed por defecto', () => {
    expect(mcpPolicyState({ access: 'all', strictPluginOnly: false })).toEqual({ state: 'allowed' });
    expect(mcpPolicyState({ access: undefined, strictPluginOnly: false })).toEqual({ state: 'allowed' });
  });
  it('blocked con access none (o false) o con la política estricta', () => {
    expect(mcpPolicyState({ access: 'none', strictPluginOnly: false })).toEqual({ state: 'blocked', reason: 'chat.mcp.access = none' });
    expect(mcpPolicyState({ access: false, strictPluginOnly: false }).state).toBe('blocked');
    expect(mcpPolicyState({ access: 'all', strictPluginOnly: true })).toEqual({ state: 'blocked', reason: 'política ChatStrictPluginOnlyCustomization' });
  });
  it('registryOnly con access registry', () => {
    expect(mcpPolicyState({ access: 'registry', strictPluginOnly: false })).toEqual({ state: 'registryOnly', reason: 'chat.mcp.access = registry' });
  });
});

describe('strictBlocksMcp (valor de chat.customizations.strictPluginOnlyCustomization)', () => {
  it.each([
    [true, true],
    [false, false],
    [undefined, false],
    [[], false],
    [['agents'], false],
    [['mcp'], true],
    [['agents', 'mcp'], true],
    ['mcp', false],
  ])('%j → %s', (value, expected) => {
    expect(strictBlocksMcp(value)).toBe(expected);
  });
});

describe('findOnPath', () => {
  const bin = () => {
    const dir = mkdtempSync(join(tmpdir(), 'path-'));
    const file = join(dir, 'uv');
    writeFileSync(file, '#!/bin/sh\n');
    chmodSync(file, 0o755);
    mkdirSync(join(dir, 'aws'));
    return dir;
  };
  it('encuentra un ejecutable y no confunde carpetas con archivos', async () => {
    const dir = bin();
    const env = { PATH: ['/no/existe', dir].join(delimiter) };
    expect(await findOnPath('uv', env, 'linux')).toBe(true);
    expect(await findOnPath('aws', env, 'linux')).toBe(false);
    expect(await findOnPath('az', env, 'linux')).toBe(false);
  });
  it('en Windows prueba las extensiones de PATHEXT', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'path-'));
    writeFileSync(join(dir, 'az.CMD'), '@echo off\r\n');
    expect(await findOnPath('az', { PATH: dir, PATHEXT: '.EXE;.CMD' }, 'win32')).toBe(true);
    expect(await findOnPath('az', { PATH: dir, PATHEXT: '.EXE' }, 'win32')).toBe(false);
  });
  it('sin PATH devuelve false', async () => {
    expect(await findOnPath('uv', {}, 'linux')).toBe(false);
  });
});

describe('isIgnoredBy (.gitignore de la raíz)', () => {
  const file = '.vscode/mcp.json';
  it.each([
    ['', false],
    ['node_modules/\ndist/', false],
    ['.vscode', true],
    ['.vscode/', true],
    ['/.vscode/', true],
    ['.vscode/*', true],
    ['.vscode/*\n!.vscode/mcp.json', false],
    ['.vscode/\n!.vscode/mcp.json', true],
    ['*.json', true],
    ['# .vscode', false],
    ['**/mcp.json', true],
    ['/mcp.json', false],
  ])('%j → %s', (gitignore, expected) => {
    expect(isIgnoredBy(gitignore, file)).toBe(expected);
  });
});
