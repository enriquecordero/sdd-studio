import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');
const ctx = await esbuild.context({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  // jsonc-parser: su build UMD hace require() dinámicos que esbuild no resuelve; el ESM sí.
  mainFields: ['module', 'main'],
  target: 'node20',
  sourcemap: true,
});
if (watch) {
  await ctx.watch();
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
