export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type PdfPreviewSize = 'small' | 'medium' | 'large';

export function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

export function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#96;/g, '`');
}

export function sanitizeFileName(value: string, fallback = 'cetele-not'): string {
  const cleaned = decodeHtml(value)
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 72)
    .trim();

  return cleaned || fallback;
}

export function getPdfFileNameFromUrl(url: string, fallback = 'PDF belgesi'): string {
  try {
    const parsed = new URL(url);
    const pathName = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '');
    return pathName || fallback;
  } catch {
    const pathName = decodeURIComponent(url.split('?')[0].split('/').filter(Boolean).pop() || '');
    return pathName || fallback;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function figureHasPdfUrl(figureHtml: string, rawUrl: string): boolean {
  const escapedUrl = escapeRegExp(rawUrl);
  const encodedUrl = escapeRegExp(encodeURIComponent(rawUrl));
  return new RegExp(`data-raw-url=["']${escapedUrl}["']`, 'i').test(figureHtml)
    || new RegExp(`href=["']${escapedUrl}["']`, 'i').test(figureHtml)
    || new RegExp(`url=${encodedUrl}`, 'i').test(figureHtml)
    || figureHtml.includes(rawUrl);
}

export function renamePdfInHtml(html: string, rawUrl: string, nextTitle: string): string {
  const safeTitle = sanitizeFileName(nextTitle, 'PDF belgesi');
  const escapedTitle = escapeAttr(safeTitle);

  return html.replace(
    /<(figure|a)\b[^>]*(?:pdf-viewer-card|file-card)[^>]*>[\s\S]*?<\/\1>/gi,
    (match) => {
      if (!figureHasPdfUrl(match, rawUrl)) return match;

      let next = match.replace(/data-pdf-title=["'][^"']*["']/gi, `data-pdf-title="${escapedTitle}"`);

      if (!/data-pdf-title=["'][^"']*["']/i.test(match)) {
        next = next.replace(/(<(?:figure|a)\b[^>]*)(>)/i, `$1 data-pdf-title="${escapedTitle}"$2`);
      }

      if (/<span[^>]*class=["'][^"']*pdf-title[^"']*["'][^>]*>[\s\S]*?<\/span>/i.test(next)) {
        next = next.replace(
          /<span([^>]*class=["'][^"']*pdf-title[^"']*["'][^>]*)>[\s\S]*?<\/span>/i,
          `<span$1>${escapeHtml(safeTitle)}</span>`
        );
      }

      if (/<div[^>]*class=["'][^"']*file-title[^"']*["'][^>]*>[\s\S]*?<\/div>/i.test(next)) {
        next = next.replace(
          /<div([^>]*class=["'][^"']*file-title[^"']*["'][^>]*)>[\s\S]*?<\/div>/i,
          `<div$1>${escapeHtml(safeTitle)}</div>`
        );
      }

      return next;
    }
  );
}

export function deletePdfFromHtml(html: string, rawUrl: string): string {
  return html
    .replace(
      /<(figure|a)\b[^>]*(?:pdf-viewer-card|file-card)[^>]*>[\s\S]*?<\/\1>\s*(?:<p><br><\/p>)?/gi,
      (match) => (figureHasPdfUrl(match, rawUrl) ? '<p><br></p>' : match)
    )
    .replace(/(?:<p><br><\/p>\s*){3,}/gi, '<p><br></p><p><br></p>');
}
