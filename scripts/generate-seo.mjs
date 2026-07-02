import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const fallbackSiteUrl = 'https://cetelenostr.netlify.appp';
const siteUrl = (process.env.EXPO_PUBLIC_SITE_URL || process.env.URL || fallbackSiteUrl).replace(/\/$/, '');
const publicDirectory = resolve(process.cwd(), 'public');
const publicRoutes = ['/', '/privacy', '/support', '/technical-documentation'];
const today = new Date().toISOString().slice(0, 10);

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${publicRoutes
  .map(
    (route) => `  <url>
    <loc>${siteUrl}${route}</loc>
    <lastmod>${today}</lastmod>
  </url>`
  )
  .join('\n')}
</urlset>
`;

const robots = `User-agent: *
Allow: /
Disallow: /note/
Disallow: /edit/
Disallow: /new
Disallow: /signer-callback

Sitemap: ${siteUrl}/sitemap.xml
`;

await mkdir(publicDirectory, { recursive: true });
await Promise.all([
  writeFile(resolve(publicDirectory, 'sitemap.xml'), sitemap, 'utf8'),
  writeFile(resolve(publicDirectory, 'robots.txt'), robots, 'utf8'),
]);
