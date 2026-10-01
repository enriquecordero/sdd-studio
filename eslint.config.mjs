import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'out/**', 'node_modules/**', '.vscode-test/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: [
      'src/specs/**/*.ts',
      'src/workspace/resolve.ts',
      'src/copilot/prompts.ts',
      'src/ui/labels.ts',
      'src/ui/lensModel.ts',
      'src/doctor/checks.ts',
    ],
    rules: {
      'no-restricted-imports': ['error', { paths: [{ name: 'vscode', message: 'Módulo puro: no importes vscode.' }] }],
    },
  },
);
