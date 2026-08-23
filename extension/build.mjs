/**
 * Extension build: bundles TS content/background scripts to plain JS that
 * Chrome can load unpacked. Copies manifest + popup.html into the build dir.
 * Zero runtime deps shipped; esbuild is the only devDependency.
 */
import { build, context } from 'esbuild';
import { copyFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outdir = path.join(__dirname, 'dist');
const iconSizes = [16, 32, 48, 128];
mkdirSync(outdir, { recursive: true });

// Content scripts must be classic (IIFE) scripts, not ESM modules.
const iifeOpts = {
  entryPoints: {
    'x-bookmark-listener': 'src/x-bookmark-listener.ts',
    'agreement-detector': 'src/agreement-detector.ts',
    'popup': 'src/popup.ts',
  },
  outdir,
  bundle: true,
  format: 'iife',
  target: 'chrome110',
  logLevel: 'info',
};

// Background service worker is declared type:module in the manifest.
const esmOpts = {
  entryPoints: { 'background': 'src/background.ts' },
  outdir,
  bundle: true,
  format: 'esm',
  target: 'chrome110',
  logLevel: 'info',
};

function copyStatic() {
  copyFileSync(path.join(__dirname, 'manifest.json'), path.join(outdir, 'manifest.json'));
  copyFileSync(path.join(__dirname, 'src', 'popup.html'), path.join(outdir, 'popup.html'));

  const iconOutdir = path.join(outdir, 'icons');
  mkdirSync(iconOutdir, { recursive: true });
  for (const size of iconSizes) {
    copyFileSync(
      path.join(__dirname, 'public', 'icons', `nudge-${size}.png`),
      path.join(iconOutdir, `nudge-${size}.png`),
    );
  }
}

const watch = process.argv.includes('--watch');

if (watch) {
  const c1 = await context(iifeOpts);
  const c2 = await context(esmOpts);
  await c1.watch();
  await c2.watch();
  copyStatic();
  console.log('[build] watching…');
} else {
  await build(iifeOpts);
  await build(esmOpts);
  copyStatic();
  console.log('[build] done ->', outdir);
}
