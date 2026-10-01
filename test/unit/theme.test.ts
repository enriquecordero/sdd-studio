import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '../..');

describe('tema', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  it('está registrado como SDD Studio Dark', () => {
    expect(pkg.contributes.themes).toEqual([
      { label: 'SDD Studio Dark', uiTheme: 'vs-dark', path: './themes/sdd-studio-dark-color-theme.json' },
    ]);
  });
  it('usa la paleta Kiro', () => {
    const theme = JSON.parse(readFileSync(join(root, 'themes/sdd-studio-dark-color-theme.json'), 'utf8'));
    expect(theme.colors['editor.background']).toBe('#211d25');
    expect(theme.colors['focusBorder']).toBe('#b080ff');
    expect(theme.colors['button.background']).toBe('#7138cc');
    expect(theme.tokenColors.length).toBeGreaterThan(5);
  });
  it('NOTICE da crédito al tema original', () => {
    expect(readFileSync(join(root, 'NOTICE'), 'utf8')).toContain('MohdZaid.kiro-theme');
  });
});
