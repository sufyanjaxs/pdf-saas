/**
 * Copies the pdf.js worker from node_modules into the web app's public/ dir
 * so the browser can load it as a static asset (workerSrc).
 * Runs automatically on predev / prebuild.
 */
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const candidates = [
  join(root, 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.min.js'),
  join(root, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.js'),
];

const src = candidates.find((p) => existsSync(p));
if (!src) {
  console.error('[copy-pdfjs-worker] pdf.worker.min.js not found. Run `npm install` first.');
  process.exit(1);
}

const destDir = join(root, 'apps', 'web', 'public');
mkdirSync(destDir, { recursive: true });
const dest = join(destDir, 'pdf.worker.min.js');
copyFileSync(src, dest);
console.log(`[copy-pdfjs-worker] copied ${src} -> ${dest}`);
