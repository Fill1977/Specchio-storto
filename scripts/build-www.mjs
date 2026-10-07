// Copia i file del sito in www/, la cartella che Capacitor impacchetta nell'APK.
import { cpSync, rmSync, mkdirSync } from 'node:fs';

const FILES = ['index.html', 'privacy.html', 'manifest.json',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
const DIRS = ['css', 'js', 'fonts'];

rmSync('www', { recursive: true, force: true });
mkdirSync('www');
FILES.forEach(f => cpSync(f, `www/${f}`));
DIRS.forEach(d => cpSync(d, `www/${d}`, { recursive: true }));
console.log('www/ pronta');
