import { describe, expect, it } from 'vitest';
import { compareVersions, DoctorEnv, runChecks } from '../../../src/doctor/checks';

const healthy: DoctorEnv = {
  vscodeVersion: '1.140.0',
  minVersion: '1.140.0',
  copilotChatInstalled: true,
  githubSignedIn: true,
  agentModeEnabled: true,
  extensionToolsEnabled: true,
  strictPluginOnly: false,
};

describe('compareVersions', () => {
  it('compara numéricamente e ignora sufijos', () => {
    expect(compareVersions('1.140.0', '1.139.9')).toBeGreaterThan(0);
    expect(compareVersions('1.99.0', '1.140.0')).toBeLessThan(0);
    expect(compareVersions('1.140.0-insider', '1.140.0')).toBe(0);
  });
});

describe('runChecks', () => {
  it('todo bien', () => {
    expect(runChecks(healthy).every((c) => c.ok)).toBe(true);
  });
  it('cada problema da su check con acción', () => {
    const results = runChecks({
      ...healthy,
      vscodeVersion: '1.120.0',
      copilotChatInstalled: false,
      githubSignedIn: false,
      agentModeEnabled: false,
      extensionToolsEnabled: false,
      strictPluginOnly: true,
    });
    const failed = results.filter((c) => !c.ok);
    expect(failed.map((c) => c.id)).toEqual([
      'vscode-version',
      'copilot-chat',
      'github-session',
      'agent-mode',
      'extension-tools',
      'strict-policy',
    ]);
    expect(failed.every((c) => c.action)).toBe(true);
    expect(failed.find((c) => c.id === 'strict-policy')!.severity).toBe('warning');
    expect(failed.find((c) => c.id === 'copilot-chat')!.severity).toBe('error');
  });
  it('sesión de GitHub desconocida no es un problema (I2)', () => {
    const session = runChecks({ ...healthy, githubSignedIn: 'unknown' }).find((c) => c.id === 'github-session')!;
    expect(session).toMatchObject({
      ok: true,
      message: 'Sesión de GitHub no verificada (VS Code no lo permite sin permiso)',
    });
    expect(session.action).toBeUndefined();
  });
  it('solo una sesión ausente confirmada avisa', () => {
    const session = runChecks({ ...healthy, githubSignedIn: false }).find((c) => c.id === 'github-session')!;
    expect(session).toMatchObject({ ok: false, severity: 'warning' });
    expect(runChecks(healthy).find((c) => c.id === 'github-session')!.message).toBe('Sesión de GitHub activa');
  });
  it('el aviso de la política estricta dice "puede impedir"', () => {
    const strict = runChecks({ ...healthy, strictPluginOnly: true }).find((c) => c.id === 'strict-policy')!;
    expect(strict.message).toBe(
      'La política ChatStrictPluginOnlyCustomization está activa: puede impedir que se carguen las instructions de steering de .github/instructions (y, más adelante, los Powers del repo).',
    );
  });
});
