import * as vscode from 'vscode';

const OFFERED_KEY = 'sddStudio.themeOffered';
export const THEME_LABEL = 'SDD Studio Dark';

export async function offerThemeOnce(context: vscode.ExtensionContext): Promise<void> {
  if (context.globalState.get(OFFERED_KEY)) return;
  if (vscode.workspace.getConfiguration('workbench').get<string>('colorTheme') === THEME_LABEL) return;
  await context.globalState.update(OFFERED_KEY, true);
  const pick = await vscode.window.showInformationMessage(`¿Activar el tema ${THEME_LABEL}?`, 'Activar', 'Ahora no');
  if (pick === 'Activar') {
    await vscode.workspace.getConfiguration('workbench').update('colorTheme', THEME_LABEL, vscode.ConfigurationTarget.Global);
  }
}
