import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { File as ExpoFile, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { Note } from '@/types/note';
import {
  decodeHtml,
  escapeHtml,
  getPdfFileNameFromUrl,
  sanitizeFileName,
} from './pdf-content';
import { renderLatexInHtml, replaceRenderedLatexWithText } from './math-content';

const MARKDOWN_MIME = 'text/markdown';
const PDF_MIME = 'application/pdf';

export interface ExportedFile {
  uri: string;
  fileName: string;
  mimeType: string;
  uti?: string;
}

export interface NoteExportText {
  untitledNote?: string;
  updated?: string;
  appName?: string;
  pdfDocument?: string;
  file?: string;
  video?: string;
  shareFormattedText?: string;
  sharePdf?: string;
  ceteleNote?: string;
  pdfShare?: string;
  locale?: string;
}

const DEFAULT_EXPORT_TEXT: Required<NoteExportText> = {
  untitledNote: 'Başlıksız not',
  updated: 'Güncelleme',
  appName: 'Çetele',
  pdfDocument: 'PDF belgesi',
  file: 'Dosya',
  video: 'Video',
  shareFormattedText: 'Biçimlendirilmiş metin olarak paylaş',
  sharePdf: 'PDF olarak paylaş',
  ceteleNote: 'Çetele notu',
  pdfShare: 'PDF paylaş',
  locale: 'tr-TR',
};

function exportText(text?: NoteExportText): Required<NoteExportText> {
  return { ...DEFAULT_EXPORT_TEXT, ...text };
}

function stripEditorControls(html: string): string {
  return html
    .replace(/<div[^>]*class=["'][^"']*note-table-controls[^"']*["'][\s\S]*?<\/div>/gi, '')
    .replace(/<div[^>]*class=["'][^"']*note-table-column-handles[^"']*["'][\s\S]*?<\/div>/gi, '')
    .replace(/<div[^>]*class=["'][^"']*note-table-row-handles[^"']*["'][\s\S]*?<\/div>/gi, '')
    .replace(/<div[^>]*class=["'][^"']*note-table-popover[^"']*["'][\s\S]*?<\/div>/gi, '')
    .replace(/<div[^>]*class=["'][^"']*drawing-toolbar[^"']*["'][\s\S]*?<\/div>/gi, '')
    .replace(/<figure[^>]*class=["'][^"']*upload-placeholder-card[^"']*["'][\s\S]*?<\/figure>/gi, '')
    .replace(/<button[^>]*data-[^>]*>[\s\S]*?<\/button>/gi, '')
    .replace(/\scontenteditable=(["'])[^"']*\1/gi, '')
    .replace(/\sstyle=(["'])caret-color:[\s\S]*?\1/gi, '');
}

function stripTags(value: string): string {
  const withMathText = replaceRenderedLatexWithText(renderLatexInHtml(value));
  return decodeHtml(
    withMathText
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

function extractAttr(html: string, attr: string): string {
  const match = html.match(new RegExp(`${attr}=["']([^"']+)["']`, 'i'));
  return match ? decodeHtml(match[1]) : '';
}

function normalizeMarkdownSpacing(value: string): string {
  return value
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeTableCell(value: string): string {
  return stripTags(value)
    .replace(/\s+/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();
}

function tableHtmlToMarkdown(tableHtml: string): string {
  const rows = Array.from(tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi))
    .map((rowMatch) => Array.from(rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi))
      .map((cellMatch) => normalizeTableCell(cellMatch[1]) || ' '))
    .filter((row) => row.length > 0);

  if (rows.length === 0) return '\n\n';

  const columnCount = Math.max(...rows.map((row) => row.length));
  const normalizedRows = rows.map((row) => {
    const nextRow = [...row];
    while (nextRow.length < columnCount) nextRow.push(' ');
    return nextRow;
  });

  const header = normalizedRows[0];
  const separator = Array.from({ length: columnCount }, () => '---');
  const body = normalizedRows.slice(1);
  const markdownRows = [header, separator, ...body]
    .map((row) => `| ${row.join(' | ')} |`)
    .join('\n');

  return `\n\n${markdownRows}\n\n`;
}

export function noteToMarkdown(note: Note, text?: NoteExportText): string {
  const labels = exportText(text);
  let html = replaceRenderedLatexWithText(renderLatexInHtml(stripEditorControls(note.content || '')));

  html = html.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, (match) => tableHtmlToMarkdown(match));

  html = html.replace(/<figure[^>]*class=["'][^"']*pdf-viewer-card[^"']*["'][^>]*[\s\S]*?<\/figure>/gi, (match) => {
    const url = extractAttr(match, 'data-raw-url') || extractAttr(match, 'src');
    const title = extractAttr(match, 'data-pdf-title') || getPdfFileNameFromUrl(url || '', labels.pdfDocument);
    return url ? `\n\n[PDF: ${title}](${url})\n\n` : `\n\n[PDF: ${title}]\n\n`;
  });

  html = html.replace(/<a[^>]*class=["'][^"']*file-card[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (match, url) => {
    const titleMatch = match.match(/<div[^>]*class=["'][^"']*file-title[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    const title = titleMatch ? stripTags(titleMatch[1]) : getPdfFileNameFromUrl(url, labels.file);
    return `\n\n[${title}](${url})\n\n`;
  });

  html = html
    .replace(/<figure[^>]*(?:data-media-type=["']drawing["']|class=["'][^"']*drawing-card[^"']*["'])[^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>[\s\S]*?<\/figure>/gi, '\n\n![$2]($1)\n\n')
    .replace(/<figure[^>]*(?:data-media-type=["']drawing["']|class=["'][^"']*drawing-card[^"']*["'])[^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["'][^>]*>[\s\S]*?<\/figure>/gi, '\n\n![]($1)\n\n')
    .replace(/<figure[^>]*data-media-type=["']image["'][^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>[\s\S]*?<\/figure>/gi, '\n\n![$2]($1)\n\n')
    .replace(/<figure[^>]*data-media-type=["']image["'][^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["'][^>]*>[\s\S]*?<\/figure>/gi, '\n\n![]($1)\n\n')
    .replace(/<figure[^>]*data-media-type=["']video["'][^>]*>[\s\S]*?<video[^>]*src=["']([^"']+)["'][^>]*>[\s\S]*?<\/figure>/gi, (_, url) => `\n\n[${labels.video}](${url})\n\n`)
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n')
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, body) => {
      const text = stripTags(body);
      return `\n\n${text.split('\n').map((line) => `> ${line}`).join('\n')}\n\n`;
    })
    .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n\n```\n$1\n```\n\n')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
    .replace(/<s[^>]*>([\s\S]*?)<\/s>/gi, '~~$1~~')
    .replace(/<strike[^>]*>([\s\S]*?)<\/strike>/gi, '~~$1~~')
    .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, url, label) => `[${stripTags(label)}](${url})`)
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, item) => `\n- ${stripTags(item)}`)
    .replace(/<\/(?:ul|ol)>/gi, '\n')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n\n$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n');

  const body = normalizeMarkdownSpacing(stripTags(html));
  const title = note.title?.trim() || labels.untitledNote;
  const updatedAt = new Date(note.updatedAt || Date.now()).toLocaleString(labels.locale);

  return normalizeMarkdownSpacing(`# ${title}\n\n_${labels.updated}: ${updatedAt}_\n\n${body}`);
}

export function buildPrintableNoteHtml(note: Note, text?: NoteExportText): string {
  const labels = exportText(text);
  const title = escapeHtml(note.title?.trim() || labels.untitledNote);
  const updatedAt = new Date(note.updatedAt || Date.now()).toLocaleString(labels.locale);
  const content = renderLatexInHtml(stripEditorControls(note.content || '')
    .replace(/<figure([^>]*)class=["']([^"']*)pdf-viewer-card([^"']*)["']([^>]*)>[\s\S]*?<\/figure>/gi, (match) => {
      const url = extractAttr(match, 'data-raw-url') || extractAttr(match, 'src');
      const name = extractAttr(match, 'data-pdf-title') || getPdfFileNameFromUrl(url || '', labels.pdfDocument);
      return `<section class="pdf-export-card"><div class="pdf-export-kicker">PDF</div><a href="${escapeHtml(url)}">${escapeHtml(name)}</a></section>`;
    })
    .replace(/<button[^>]*>[\s\S]*?<\/button>/gi, ''));

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    @page { margin: 42px 40px; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #111111;
      background: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      font-size: 15px;
      line-height: 1.55;
    }
    header { margin-bottom: 28px; padding-bottom: 18px; border-bottom: 1px solid #d9d9df; }
    h1 { margin: 0 0 8px; font-size: 30px; line-height: 1.18; letter-spacing: 0; }
    .meta { color: #6b6b76; font-size: 12px; font-weight: 600; }
    h2 { margin-top: 24px; font-size: 22px; }
    p { margin: 0 0 10px; }
    a { color: #005ecb; text-decoration: none; }
    blockquote { margin: 16px 0; padding: 12px 16px; border-left: 4px solid #0A84FF; background: #f5f8ff; color: #30343b; }
    code { font-family: "SF Mono", Menlo, Consolas, monospace; background: #f1f1f4; padding: 2px 5px; border-radius: 5px; }
    pre { padding: 14px; overflow-wrap: anywhere; background: #111113; color: #f5f5f7; border-radius: 10px; }
    img, video, svg { max-width: 100%; height: auto; border-radius: 12px; }
    .math-inline { display: inline-flex; vertical-align: -0.16em; }
    .math-display { display: block; margin: 14px 0; padding: 12px 14px; border: 1px solid #d8d8df; border-radius: 12px; background: #f7f7f9; overflow-x: auto; }
    .math-inline *, .math-display * { max-width: none !important; }
    table { width: 100%; border-collapse: collapse; margin: 14px 0; }
    td, th { border: 1px solid #d8d8df; padding: 9px 10px; vertical-align: top; }
    tr:first-child td, th { background: #eef5ff; font-weight: 700; }
    .media-card { display: block; margin: 14px 0; max-width: 100%; }
    .drawing-card { display: block; margin: 14px 0; max-width: 100%; aspect-ratio: 4 / 3; background: #000000; border-radius: 12px; overflow: hidden; }
    .drawing-card img { width: 100%; height: 100%; object-fit: contain; background: #000000; }
    .file-card, .pdf-export-card {
      display: block;
      margin: 14px 0;
      padding: 14px 16px;
      color: #111111;
      text-decoration: none;
      border: 1px solid #d8d8df;
      border-radius: 12px;
      background: #f7f7f9;
      page-break-inside: avoid;
    }
    .file-icon-placeholder, .file-meta, .media-caption, .pdf-click-overlay, .pdf-card-header { display: none !important; }
    .file-title { font-weight: 700; }
    .pdf-export-kicker { color: #6b6b76; font-size: 11px; font-weight: 800; letter-spacing: 0; text-transform: uppercase; margin-bottom: 4px; }
  </style>
</head>
<body>
  <header>
    <h1>${title}</h1>
    <div class="meta">${escapeHtml(labels.appName)} · ${escapeHtml(updatedAt)}</div>
  </header>
  <main>${content}</main>
</body>
</html>`;
}

function noteFileName(note: Note, extension: string): string {
  return `${sanitizeFileName(note.title || 'cetele-not')}.${extension}`;
}

function writeTextFile(fileName: string, content: string, mimeType: string): ExportedFile {
  const file = new ExpoFile(Paths.cache, fileName);
  if (file.exists) {
    file.delete();
  }
  file.create({ overwrite: true, intermediates: true });
  file.write(content);
  return { uri: file.uri, fileName, mimeType };
}

function writeBytesFile(fileName: string, bytes: Uint8Array, mimeType: string): ExportedFile {
  const file = new ExpoFile(Paths.cache, fileName);
  if (file.exists) {
    file.delete();
  }
  file.create({ overwrite: true, intermediates: true });
  file.write(bytes);
  return { uri: file.uri, fileName, mimeType };
}

function downloadTextOnWeb(fileName: string, content: string, mimeType: string) {
  if (Platform.OS !== 'web') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function openPrintableHtmlOnWeb(html: string, fileName: string) {
  if (Platform.OS !== 'web') return;

  const printableTitle = fileName.replace(/\.pdf$/i, '');
  const printScript = `
    <script>
      (function() {
        document.title = ${JSON.stringify(printableTitle)};
        window.addEventListener('load', function() {
          setTimeout(function() {
            window.focus();
            window.print();
          }, 250);
        });
      })();
    </script>
  `;
  const printableHtml = html.includes('</body>')
    ? html.replace('</body>', `${printScript}</body>`)
    : `${html}${printScript}`;
  const printWindow = window.open('', '_blank');

  if (!printWindow) {
    downloadTextOnWeb(fileName.replace(/\.pdf$/i, '.html'), printableHtml, 'text/html;charset=utf-8');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(printableHtml);
  printWindow.document.close();
}

async function shareWebTextFile(fileName: string, content: string, mimeType: string): Promise<boolean> {
  if (Platform.OS !== 'web') return false;
  const navigatorAny = navigator as any;
  const WebFile = globalThis.File;
  if (!navigatorAny?.share || !WebFile) return false;

  try {
    const file = new WebFile([content], fileName, { type: mimeType });
    if (navigatorAny.canShare?.({ files: [file] })) {
      await navigatorAny.share({ files: [file], title: fileName });
      return true;
    }

    await navigatorAny.share({ title: fileName, text: content });
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return true;
    }
    return false;
  }
}

export function createMarkdownExport(note: Note, text?: NoteExportText): ExportedFile {
  const markdown = noteToMarkdown(note, text);
  const fileName = noteFileName(note, 'md');

  if (Platform.OS === 'web') {
    downloadTextOnWeb(fileName, markdown, MARKDOWN_MIME);
    return { uri: '', fileName, mimeType: MARKDOWN_MIME };
  }

  return writeTextFile(fileName, markdown, MARKDOWN_MIME);
}

export async function createPdfExport(note: Note, text?: NoteExportText): Promise<ExportedFile> {
  const html = buildPrintableNoteHtml(note, text);
  const fileName = noteFileName(note, 'pdf');

  if (Platform.OS === 'web') {
    openPrintableHtmlOnWeb(html, fileName);
    return { uri: '', fileName, mimeType: PDF_MIME, uti: 'com.adobe.pdf' };
  }

  const result = await Print.printToFileAsync({
    html,
    width: 612,
    height: 792,
    margins: { top: 36, right: 34, bottom: 36, left: 34 },
  });
  const source = new ExpoFile(result.uri);
  return writeBytesFile(fileName, await source.bytes(), PDF_MIME);
}

export async function shareExportedFile(file: ExportedFile, dialogTitle?: string) {
  if (Platform.OS === 'web') return;

  const available = await Sharing.isAvailableAsync();
  if (available) {
    await Sharing.shareAsync(file.uri, {
      mimeType: file.mimeType,
      UTI: file.uti,
      dialogTitle: dialogTitle || file.fileName,
    });
    return;
  }

  await Share.share({
    title: file.fileName,
    message: file.uri,
    url: file.uri,
  });
}

export async function shareMarkdownExport(note: Note, text?: NoteExportText) {
  const markdown = noteToMarkdown(note, text);
  const fileName = noteFileName(note, 'md');

  if (Platform.OS === 'web') {
    const shared = await shareWebTextFile(fileName, markdown, MARKDOWN_MIME).catch(() => false);
    if (!shared) downloadTextOnWeb(fileName, markdown, MARKDOWN_MIME);
    return;
  }

  await shareExportedFile(writeTextFile(fileName, markdown, MARKDOWN_MIME), exportText(text).shareFormattedText);
}

export async function sharePdfExport(note: Note, text?: NoteExportText) {
  const file = await createPdfExport(note, text);
  await shareExportedFile({ ...file, uti: 'com.adobe.pdf' }, exportText(text).sharePdf);
}

export async function printNote(note: Note, text?: NoteExportText) {
  if (Platform.OS === 'web') {
    openPrintableHtmlOnWeb(buildPrintableNoteHtml(note, text), noteFileName(note, 'pdf'));
    return;
  }

  await Print.printAsync({
    html: buildPrintableNoteHtml(note, text),
    orientation: Print.Orientation.portrait,
    margins: { top: 36, right: 34, bottom: 36, left: 34 },
  });
}

export async function shareNoteText(note: Note, text?: NoteExportText) {
  const labels = exportText(text);
  const markdown = noteToMarkdown(note, text);
  if (Platform.OS === 'web') {
    if (navigator.share) {
      try {
        await navigator.share({ title: note.title || labels.ceteleNote, text: markdown });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
      }
    }
    await Clipboard.setStringAsync(markdown);
    return;
  }
  await Share.share({ title: note.title || labels.ceteleNote, message: markdown });
}

export async function copyNoteMarkdown(note: Note, text?: NoteExportText): Promise<boolean> {
  return copyText(noteToMarkdown(note, text));
}

export async function copyText(value: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(value);
    return true;
  } catch {
    if (Platform.OS === 'web' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

export async function prepareRemoteDocument(url: string, title?: string, text?: NoteExportText): Promise<ExportedFile> {
  const fileName = sanitizeFileName(title || getPdfFileNameFromUrl(url), exportText(text).pdfDocument)
    .replace(/\.pdf$/i, '') + '.pdf';

  if (Platform.OS === 'web' || url.startsWith('file:')) {
    return { uri: url, fileName, mimeType: PDF_MIME, uti: 'com.adobe.pdf' };
  }

  const file = new ExpoFile(Paths.cache, fileName);
  await ExpoFile.downloadFileAsync(url, file, { idempotent: true });
  return { uri: file.uri, fileName, mimeType: PDF_MIME, uti: 'com.adobe.pdf' };
}

export async function shareRemoteDocument(url: string, title?: string, text?: NoteExportText) {
  const labels = exportText(text);
  if (Platform.OS === 'web') {
    if (navigator.share) {
      try {
        await navigator.share({ title: title || labels.pdfDocument, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
      }
    }
    window.open(url, '_blank');
    return;
  }

  await shareExportedFile(await prepareRemoteDocument(url, title, text), labels.pdfShare);
}

export async function saveRemoteDocument(url: string, title?: string, text?: NoteExportText) {
  await shareRemoteDocument(url, title, text);
}

export async function printRemotePdf(url: string, title?: string, text?: NoteExportText) {
  if (Platform.OS === 'web') {
    window.open(url, '_blank');
    return;
  }

  const file = await prepareRemoteDocument(url, title, text);
  await Print.printAsync({ uri: file.uri });
}
