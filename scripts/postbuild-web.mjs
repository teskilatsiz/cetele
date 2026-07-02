import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const distDirectory = resolve(process.cwd(), 'dist');

// Netlify automatically serves /404.html for unmatched static routes.
// Expo Router exports the same no-index page as /+not-found.html.
await copyFile(
  resolve(distDirectory, '+not-found.html'),
  resolve(distDirectory, '404.html')
);
