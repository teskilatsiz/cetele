const ATOMIC_CONTENT_PATTERN =
  /<(img|video|table|canvas|iframe)\b|class=["'][^"']*(media-card|file-card|drawing-card|note-table-shell|pdf-viewer-card)[^"']*["']|data-has-drawing=["']true["']|data-drawing-src=["'][^"']+["']/i;

function decodeBasicEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function richTextToPlainText(html: string) {
  return decodeBasicEntities(
    String(html || '')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<table\b[\s\S]*?<\/table>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
  ).trim();
}

export function hasMeaningfulRichContent(html: string) {
  const source = String(html || '');
  if (ATOMIC_CONTENT_PATTERN.test(source)) {
    return true;
  }

  return richTextToPlainText(source).length > 0;
}
