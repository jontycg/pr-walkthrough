import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const watch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['src/content/index.ts'],
  bundle: true,
  outfile: 'build/content.js',
  format: 'iife',
  target: 'es2020',
  sourcemap: true,
};

async function build() {
  await esbuild.build(buildOptions);

  // Copy to Chrome build
  mkdirSync('build/chrome', { recursive: true });
  cpSync('build/content.js', 'build/chrome/content.js');
  cpSync('build/content.js.map', 'build/chrome/content.js.map');
  cpSync('src/content/styles.css', 'build/chrome/styles.css');
  cpSync('manifest.chrome.json', 'build/chrome/manifest.json');

  // Copy to Firefox build
  mkdirSync('build/firefox', { recursive: true });
  cpSync('build/content.js', 'build/firefox/content.js');
  cpSync('build/content.js.map', 'build/firefox/content.js.map');
  cpSync('src/content/styles.css', 'build/firefox/styles.css');
  cpSync('manifest.firefox.json', 'build/firefox/manifest.json');

  console.log('Build complete: build/chrome/ and build/firefox/');
}

if (watch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await build();
}
