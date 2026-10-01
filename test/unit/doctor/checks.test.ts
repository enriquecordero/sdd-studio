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
});
