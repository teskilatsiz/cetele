import { Image, Linking, Modal, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { WebView } from './WebView';
import * as WebBrowser from 'expo-web-browser';
import { DocumentViewer } from './DocumentViewer';
import { PdfActionSheet, type PdfActionTarget } from './PdfActionSheet';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  deletePdfFromHtml,
  escapeAttr,
  escapeHtml,
  getPdfFileNameFromUrl,
  renamePdfInHtml,
} from '@/lib/pdf-content';
import { useI18n } from '@/lib/i18n';
import { renderLatexInHtml, replaceRenderedLatexWithText } from '@/lib/math-content';
import { useAppTheme } from '@/lib/theme';

interface RichTextRendererProps {
  content: string;
  style?: any;
  previewMode?: boolean;
  onContentChange?: (nextContent: string) => void | Promise<void>;
}

function titleFromFileCard(inner: string, url: string): string {
  const titleMatch = inner.match(/<div[^>]*class=["'][^"']*file-title[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (!titleMatch) return getPdfFileNameFromUrl(url);
  return titleMatch[1]
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim() || getPdfFileNameFromUrl(url);
}

function pdfUrlFromMatch(dataRawUrl?: string, iframeSrc?: string): string {
  let url = dataRawUrl || iframeSrc || '';
  if (url.includes('gview?embedded=true&url=')) {
    url = decodeURIComponent(url.split('url=')[1] || url);
  }
  return url;
}

function getInlinePdfPreviewSource(url: string): string {
  if (/^(file|content|data|blob):/i.test(url)) {
    return url;
  }
  return Platform.OS === 'android'
    ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`
    : url;
}

function buildPdfPreviewMarkup(url: string, title: string): string {
  const rawUrl = escapeAttr(url);
  const previewUrl = escapeAttr(getInlinePdfPreviewSource(url));
  const safeTitle = escapeHtml(title || getPdfFileNameFromUrl(url));

  return (
    `<figure class="media-card pdf-viewer-card" data-media-type="pdf" data-raw-url="${rawUrl}" data-pdf-title="${escapeAttr(title)}">` +
    '<div class="pdf-card-header">' +
    `<span class="pdf-title">${safeTitle}</span>` +
    '</div>' +
    `<div class="pdf-click-overlay" data-raw-url="${rawUrl}" data-pdf-title="${escapeAttr(title)}" onclick="void(0)"></div>` +
    '<div class="pdf-preview-shell">' +
    `<iframe class="pdf-instant-frame" src="${previewUrl}" frameborder="0" scrolling="no" allowfullscreen></iframe>` +
    '<div class="pdf-pages-container"></div>' +
    '</div>' +
    '</figure><p><br></p>'
  );
}

export function RichTextRenderer({ content, style, previewMode = false, onContentChange }: RichTextRendererProps) {
  const { t } = useI18n();
  const { colors, scheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [webViewHeight, setWebViewHeight] = useState(100);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewDocument, setPreviewDocument] = useState<{ url: string; title?: string; isPdf?: boolean } | null>(null);
  const [pdfMenuTarget, setPdfMenuTarget] = useState<PdfActionTarget | null>(null);
  const [pdfNames, setPdfNames] = useState<Record<string, string>>({});
  const [hiddenPdfs, setHiddenPdfs] = useState<Record<string, boolean>>({});

  const processedContent = useMemo(() => renderLatexInHtml(content
    .replace(/contenteditable(?:=["']?true["']?)?/gi, 'contenteditable="false"')
    .replace(
      /<a[^>]*class=["'][^"']*file-card[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>(?:[\s\S]*?)<div class="file-meta">[^<]*video\/[^<]*<\/div><\/a>/gi,
      '<figure class="media-card" data-media-type="video"><video src="$1#t=0.1" controls playsinline preload="metadata"></video></figure><p><br></p>'
    )
    .replace(
      /<a[^>]*class=["'][^"']*file-card[^"']*["'][^>]*href=["']([^"']+\.(?:mp4|mov|webm))["'][^>]*>[\s\S]*?<\/a>/gi,
      '<figure class="media-card" data-media-type="video"><video src="$1#t=0.1" controls playsinline preload="metadata"></video></figure><p><br></p>'
    )
    .replace(
      /<a[^>]*class=["'][^"']*file-card[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
      (match, url, inner) => {
        if (match.toLowerCase().includes('.pdf') || match.toLowerCase().includes('application/pdf')) {
          if (hiddenPdfs[url]) return '';
          const title = pdfNames[url] || titleFromFileCard(inner, url);
          return buildPdfPreviewMarkup(url, title);
        }
        return match;
      }
    )
    .replace(
      /<figure[^>]*class=["'][^"']*pdf(?:-viewer-card|-click-overlay)[^"']*["'][\s\S]*?(?:data-raw-url=["']([^"']+)["']|<iframe[^>]*src=["']([^"']+)["'])[\s\S]*?<\/figure>/gi,
      (match, dataRawUrl, iframeSrc) => {
        let url = pdfUrlFromMatch(dataRawUrl, iframeSrc);
        if (!url) return match;
        if (hiddenPdfs[url]) return '';
        const titleMatch = match.match(/data-pdf-title=["']([^"']+)["']/i);
        const title = pdfNames[url] || (titleMatch ? titleMatch[1] : getPdfFileNameFromUrl(url));
        return buildPdfPreviewMarkup(url, title);
      }
    )
    .replace(
      /<video([^>]*)src=["']([^"']+)["']([^>]*)>/gi,
      (match, p1, p2, p3) => {
        const url = p2.includes('#t=') ? p2 : p2 + '#t=0.1';
        return `<video${p1}src="${url}"${p3}></video>`;
      }
    )
    .replace(
      /<div[^>]*class=["']([^"']*)note-table-inner([^"']*)["'][^>]*>/gi,
      '<div class="$1note-table-inner$2">'
    )
    .replace(
      /<table[^>]*class=["']([^"']*)note-table([^"']*)["'][^>]*>/gi,
      '<table class="$1note-table$2">'
    )), [content, hiddenPdfs, pdfNames]);

  const handleLinkPress = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('Error opening link:', error);
    }
  };

  const persistPdfContent = useCallback(
    async (nextContent: string) => {
      await onContentChange?.(nextContent);
    },
    [onContentChange]
  );

  const handlePdfRename = useCallback(
    async (target: PdfActionTarget, nextTitle: string) => {
      setPdfNames((current) => ({ ...current, [target.url]: nextTitle }));
      if (onContentChange) {
        await persistPdfContent(renamePdfInHtml(content, target.url, nextTitle));
      }
    },
    [content, onContentChange, persistPdfContent]
  );

  const handlePdfDelete = useCallback(
    async (target: PdfActionTarget) => {
      setHiddenPdfs((current) => ({ ...current, [target.url]: true }));
      if (onContentChange) {
        await persistPdfContent(deletePdfFromHtml(content, target.url));
      }
    },
    [content, onContentChange, persistPdfContent]
  );

  if (previewMode) {
    let plainText = replaceRenderedLatexWithText(processedContent)
      .replace(/<table\b[\s\S]*?<\/table>/gi, ' ')
      .replace(/<div[^>]*class=["'][^"']*pdf-preview-shell[^"']*["'][\s\S]*?<\/div>\s*<\/div>/gi, ' ')
      .replace(/<div[^>]*class=["'][^"']*file-icon-placeholder[^"']*["'][\s\S]*?<\/div>/gi, ' ')
      .replace(/PDF Yükleniyor\.\.\./gi, ' ')
      .replace(/<div[^>]*class=["'][^"']*file-title[^"']*["'][\s\S]*?<\/div>/gi, ' ')
      .replace(/<span[^>]*class=["'][^"']*pdf-title[^"']*["'][\s\S]*?<\/span>/gi, ' ')
      .replace(/<div[^>]*class=["'][^"']*file-meta[^"']*["'][\s\S]*?<\/div>/gi, ' ')
      .replace(/<div[^>]*class=["'][^"']*note-table-controls[^"']*["'][\s\S]*?<\/div>/gi, ' ')
      .replace(/<div[^>]*class=["'][^"']*note-table-column-handles[^"']*["'][\s\S]*?<\/div>/gi, ' ')
      .replace(/<div[^>]*class=["'][^"']*note-table-row-handles[^"']*["'][\s\S]*?<\/div>/gi, ' ')
      .replace(/<div[^>]*class=["'][^"']*note-table-popover[^"']*["'][\s\S]*?<\/div>/gi, ' ')
      .replace(/<div[^>]*class=["'][^"']*drawing-toolbar[^"']*["'][\s\S]*?<\/div>/gi, ' ')
      .replace(/<button[^>]*data-table-(?:action|menu)=["'][^"']+["'][\s\S]*?<\/button>/gi, ' ')
      .replace(/<button[^>]*data-drawing-(?:action|color)=["'][^"']+["'][\s\S]*?<\/button>/gi, ' ')
      .replace(/<button[^>]*data-remove-block=["'][^"']+["'][\s\S]*?<\/button>/gi, ' ')
      .replace(/<figcaption[^>]*>[\s\S]*?<\/figcaption>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/p>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    return (
      <View style={style}>
        <Text style={[styles.previewText, { color: colors.textSecondary }]} numberOfLines={3}>
          {plainText}
        </Text>
      </View>
    );
  }

  const pdfReadyFallbackHtml = `<div style="width:100%;padding:22px;color:#0A84FF;text-align:center;font:600 14px -apple-system,system-ui,sans-serif;">${escapeHtml(t('editor.pdfReadyTap'))}</div>`;
  const previewShortSide = Math.min(width || 390, height || 844);
  const previewCloseSize = Math.max(42, Math.min(54, Math.round(previewShortSide * 0.11)));
  const previewCloseIconSize = Math.max(18, Math.min(24, Math.round(previewCloseSize * 0.48)));
  const previewCloseTop = Math.max(insets.top + 10, 14);
  const previewCloseRight = Math.max(insets.right + 12, 14);
  const drawingBackground = scheme === 'light' ? '#FFFFFF' : '#111113';
  const drawingGridColor = scheme === 'light' ? 'rgba(17,17,20,0.075)' : 'rgba(255,255,255,0.055)';
  const scrollbarThumb = scheme === 'light' ? '#C8CDD6' : '#2C2C2E';
  const scrollbarThumbHover = scheme === 'light' ? '#B5BBC6' : '#3A3A3C';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <style>
        *, *::before, *::after {
          box-sizing: border-box;
        }
        html {
          color-scheme: ${scheme};
        }
        html, body {
          width: 100%;
          max-width: 100%;
          overflow-x: hidden;
        }
        body {
          font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: clamp(16px, 1.8vw, 17px);
          line-height: 1.48;
          color: ${colors.text};
          background-color: ${colors.background};
          margin: 0;
          padding: 0;
          word-wrap: break-word;
          overflow-x: hidden;
        }
        #content-wrapper {
          color: ${colors.text} !important;
        }
        #content-wrapper p:not([style*="color"]),
        #content-wrapper li:not([style*="color"]),
        #content-wrapper h1:not([style*="color"]),
        #content-wrapper h2:not([style*="color"]),
        #content-wrapper h3:not([style*="color"]),
        #content-wrapper h4:not([style*="color"]),
        #content-wrapper h5:not([style*="color"]),
        #content-wrapper h6:not([style*="color"]),
        #content-wrapper blockquote:not([style*="color"]) {
          color: ${colors.text} !important;
        }
        #content-wrapper {
          padding-bottom: 40px;
          width: 100%;
          max-width: 100%;
        }
        p {
          margin: 0 0 clamp(2px, 0.7vw, 3px);
          min-height: 1.48em;
        }
        p.detail-empty-line,
        p.composer-continuation {
          margin: 0 0 clamp(1px, 0.5vw, 2px);
          min-height: 0.92em;
          line-height: 0.92;
          padding: 0;
        }
        p.detail-empty-line br,
        p.composer-continuation br {
          display: none;
        }
        a { color: #0A84FF; text-decoration: underline; }
        .math-inline,
        .math-display {
          color: inherit;
          font-family: inherit !important;
          font-size: 1em;
          line-height: inherit;
          max-width: 100%;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .math-inline {
          display: inline-flex;
          align-items: baseline;
          vertical-align: baseline;
          overflow: visible;
          padding: 0.12em 0.08em;
          margin-inline: 0.06em;
        }
        .math-display {
          display: block;
          width: 100%;
          margin: 14px 0;
          padding: 12px 14px;
          border: 1px solid ${colors.border};
          border-radius: 14px;
          background: ${colors.elevated};
          overflow-x: auto;
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
        }
        .math-inline::-webkit-scrollbar,
        .math-display::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
        .math-inline *,
        .math-display * {
          color: inherit !important;
          font-family: inherit !important;
          line-height: inherit !important;
          font-weight: inherit !important;
          font-style: inherit !important;
          overflow: visible;
          max-width: none !important;
        }
        .math-inline math,
        .math-display math {
          font-family: inherit !important;
          font-size: 1em !important;
          math-style: compact;
          font-weight: inherit !important;
          font-style: inherit !important;
        }
        .math-inline math {
          vertical-align: baseline;
        }
        .math-inline mtext,
        .math-display mtext {
          font-family: inherit !important;
          font-size: 1em;
          font-weight: inherit !important;
          font-style: inherit !important;
        }
        .math-display math {
          min-width: max-content;
        }
        .katex {
          color: inherit;
          font-family: inherit !important;
          font-size: 1em !important;
          line-height: inherit !important;
        }
        .math-inline .katex {
          display: inline-flex;
          align-items: baseline;
          vertical-align: baseline;
        }
        a:has(img) { text-decoration: none !important; border: none !important; outline: none !important; }
        ul, ol { padding-left: 20px; }
        img {
          max-width: 100%;
          height: auto;
          border-radius: 14px;
          object-fit: contain;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
        }
        .note-table-shell {
          margin: 14px 0;
          border: 1px solid ${colors.border};
          border-radius: 14px;
          overflow: hidden;
          background: ${colors.elevated};
          box-shadow: 0 4px 12px ${colors.shadow};
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }
        .note-table-controls,
        .note-table-column-handles,
        .note-table-row-handles,
        .note-table-popover,
        .block-remove-button { display: none; }
        .note-table-scroll {
          width: 100%;
          max-width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: thin;
          scrollbar-color: ${scrollbarThumb} transparent;
        }
        .note-table-scroll::-webkit-scrollbar { width: ${Platform.OS === 'android' ? 4 : 8}px; height: ${Platform.OS === 'android' ? 4 : 8}px; }
        .note-table-scroll::-webkit-scrollbar-track { background: transparent; }
        .note-table-scroll::-webkit-scrollbar-thumb {
          background: ${scrollbarThumb};
          border-radius: 999px;
        }
        .note-table-scroll::-webkit-scrollbar-thumb:hover {
          background: ${scrollbarThumbHover};
        }
        .note-table-inner {
          min-width: 100%;
          width: max-content;
          max-width: none;
        }
        .note-table-row-layer { display: block !important; }
        .note-table-row {
          display: grid;
          min-width: 100%;
        }
        table.note-table {
          width: max-content;
          min-width: 100%;
          max-width: none !important;
          border-collapse: separate;
          border-spacing: 0;
          table-layout: auto;
          box-sizing: border-box;
        }
        .note-table td,
        .note-table th {
          ${Platform.OS === 'web' ? `
            padding: 16px 20px;
            min-width: 160px;
            border-right: 1px solid ${colors.border};
            border-bottom: 1px solid ${colors.border};
          ` : `
            padding: 10px 12px;
            min-width: 120px;
            border-right: 1px solid ${colors.border};
            border-bottom: 1px solid ${colors.border};
          `}
          color: ${colors.text};
          word-break: normal;
          overflow-wrap: normal;
          white-space: pre;
          max-width: none !important;
          vertical-align: top;
          background: ${colors.inputBackground};
        }
        .note-table tr:first-child td,
        .note-table th {
          background: ${colors.elevatedMuted};
          font-weight: 700;
        }

        .note-table tr:last-child td { border-bottom: none; }
        .note-table td:last-child,
        .note-table th:last-child { border-right: none; }
        .media-card,
        .drawing-card {
          display: block;
          width: 100%;
          max-width: 100%;
          margin: 14px 0;
          text-decoration: none;
          color: ${colors.text};
          cursor: pointer;
          overflow: hidden;
          border-radius: 20px;
          background: ${colors.elevated};
        }
        .drawing-card svg {
          display: block !important;
          width: 100% !important;
          height: auto !important;
          max-width: 100% !important;
          aspect-ratio: 4 / 3 !important;
          background: ${drawingBackground} !important;
          border-radius: 20px !important;
        }
        .file-card {
          position: relative;
          width: 100%;
          max-width: 100%;
          min-height: 76px;
          margin: 16px 0 18px;
          border: 1px solid ${colors.border};
          border-radius: 14px;
          overflow: hidden;
          background: ${colors.elevated};
          display: flex;
          flex-direction: row;
          align-items: center;
          padding: 12px 16px;
          text-decoration: none;
          box-sizing: border-box;
          cursor: pointer;
          touch-action: manipulation;
          caret-color: transparent;
          -webkit-user-select: none;
          user-select: none;
        }
        .file-icon-placeholder {
          width: 40px;
          height: 40px;
          background: rgba(10, 132, 255, 0.15);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 14px;
          flex-shrink: 0;
        }
        .file-icon-placeholder::after {
          content: '📄';
          font-size: 20px;
        }
        .file-content {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;
          justify-content: center;
        }
        .file-title {
          font-weight: 600;
          font-size: 16px;
          color: ${colors.text};
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 2px;
        }
        .file-meta {
          font-size: 13px;
          color: ${colors.textSecondary};
        }
        .media-card:not(.pdf-viewer-card) {
          display: block;
          width: 100%;
          max-width: 100%;
          margin: 14px 0 18px;
          padding: 0;
          border: 0;
          border-radius: 14px;
          overflow: hidden;
          background: transparent;
          box-sizing: border-box;
          text-decoration: none;
        }
        .media-frame {
          width: 100%;
          display: block;
          overflow: hidden;
          border-radius: 14px;
          background: transparent;
        }
        .media-card img,
        .media-card video {
          display: block !important;
          width: 100% !important;
          max-width: 100% !important;
          height: auto !important;
          max-height: none !important;
          object-fit: contain !important;
          border-radius: 14px !important;
          background: transparent !important;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
        }
        .media-frame img,
        .media-frame video {
          height: auto !important;
        }
        .media-card > img,
        .media-card > video {
          height: auto !important;
          max-height: none !important;
        }
        .pdf-viewer-card {
          position: relative;
          display: block !important;
          width: 100%;
          max-width: 100% !important;
          margin: 16px 0 18px;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid ${colors.border};
          background: ${colors.elevated};
          box-shadow: 0 14px 40px ${colors.shadow};
        }
        .pdf-card-header {
          position: relative;
          z-index: 24;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 8px;
          min-height: 42px;
          padding: 10px 12px;
          background: ${colors.header};
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid ${colors.border};
          color: ${colors.text};
          caret-color: transparent;
          -webkit-user-select: none;
          user-select: none;
        }
        .pdf-card-header .block-remove-button {
          position: relative;
          top: auto;
          right: auto;
          margin: 0;
          flex-shrink: 0;
        }
        .pdf-title {
          min-width: 0;
          flex: 1;
          padding: 0 !important;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font: 600 15px -apple-system, system-ui, sans-serif;
          color: ${colors.text};
          pointer-events: none;
          cursor: default;
          caret-color: transparent;
          -webkit-user-select: none;
          user-select: none;
        }
        .pdf-menu-trigger {
          appearance: none;
          width: 28px;
          height: 28px;
          flex-shrink: 0;
          border: 0;
          border-radius: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(10,132,255,0.12);
          touch-action: manipulation;
          cursor: pointer;
        }
        .pdf-menu-chevron {
          width: 8px;
          height: 8px;
          border-right: 2px solid #0A84FF;
          border-bottom: 2px solid #0A84FF;
          transform: rotate(45deg) translateY(-2px);
        }
        .pdf-click-overlay {
          position: absolute;
          z-index: 12;
          left: 0; right: 0; top: 42px; bottom: 0;
          cursor: pointer;
        }
        .pdf-preview-shell {
          position: relative;
          z-index: 1;
          --pdf-preview-padding: clamp(10px, 3vw, 22px);
          display: block;
          width: 100%;
          padding: var(--pdf-preview-padding);
          background: ${drawingBackground};
          aspect-ratio: 4 / 3;
          min-height: min(220px, 58vw);
          max-height: min(58vh, 520px);
          box-sizing: border-box;
        }
        .pdf-pages-container {
            position: absolute;
            z-index: 2;
            inset: var(--pdf-preview-padding);
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            padding: 0;
            width: auto;
            height: auto;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
          }
          .pdf-pages-container::-webkit-scrollbar { display: none; }
          .pdf-page-canvas {
            scroll-snap-align: center;
            height: 100%;
            width: 100%;
            max-width: 100%;
            object-fit: contain;
            background: white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            border-radius: 8px;
          }
          .pdf-preview-skeleton {
            width: 64%;
            height: 78%;
            max-width: 280px;
            border-radius: 10px;
            background:
              linear-gradient(90deg, rgba(255,255,255,0.08), rgba(10,132,255,0.20), rgba(255,255,255,0.08));
            background-size: 220% 100%;
            animation: pdfPreviewPulse 1.1s ease-in-out infinite;
          }
          @keyframes pdfPreviewPulse {
            0% { background-position: 100% 0; }
            100% { background-position: -100% 0; }
          }
          .pdf-preview-shell iframe {
          position: absolute;
          z-index: 1;
          display: block;
          inset: var(--pdf-preview-padding);
          width: auto;
          height: auto;
          max-width: none;
          border: 0;
          border-radius: 12px;
          background: #ffffff;
          pointer-events: none;
          box-shadow: 0 8px 28px rgba(0,0,0,0.16);
        }
        .pdf-click-overlay {
          position: absolute;
          z-index: 12;
          left: 0;
          right: 0;
          top: 42px;
          bottom: 0;
          cursor: pointer;
          background: transparent;
        }

        /* Custom Web Scrollbar */
        html, body { scrollbar-width: ${Platform.OS === 'android' ? 'none' : 'thin'}; scrollbar-color: ${scrollbarThumb} transparent; }
        ::-webkit-scrollbar { width: ${Platform.OS === 'android' ? 4 : 8}px; height: ${Platform.OS === 'android' ? 4 : 8}px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${scrollbarThumb}; border-radius: 999px; }
        ::-webkit-scrollbar-thumb:hover { background: ${scrollbarThumbHover}; }
        ${Platform.OS === 'android' ? `
          html::-webkit-scrollbar,
          body::-webkit-scrollbar {
            display: none;
            width: 0;
            height: 0;
          }
        ` : ''}
        .media-card {
          cursor: pointer;
        }
        .file-title {
          font-weight: 700;
          color: ${colors.text};
          word-break: break-word;
        }
        .media-caption {
          display: none;
        }
        .file-meta {
          padding-top: 4px;
          color: ${colors.textSecondary};
          font-size: 13px;
        }
        .drawing-placeholder {
          min-height: 180px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${colors.textSecondary};
          background:
            linear-gradient(${drawingGridColor} 1px, transparent 1px),
            linear-gradient(90deg, ${drawingGridColor} 1px, transparent 1px),
            ${drawingBackground};
          background-size: 22px 22px;
        }
        .drawing-card {
          display: block;
          width: 100%;
          max-width: 100%;
          padding: 0;
          aspect-ratio: 4 / 3;
          overflow: hidden;
          border-radius: 12px;
          background: ${drawingBackground};
          border: 1px solid ${colors.border};
        }
        .drawing-toolbar,
        .drawing-surface,
        .drawing-canvas {
          display: none;
        }
        .drawing-image {
          display: block;
          width: 100%;
          height: 100%;
          max-width: 100%;
          max-height: none;
          object-fit: contain;
          border-radius: 12px;
          background: ${drawingBackground};
        }
        .drawing-image:not([src]),
        .drawing-image[src=""] {
          display: none;
        }
        @media (max-width: 430px) {
          table.note-table { min-width: 320px; }
          .note-table td,
          .note-table th {
            min-width: 96px;
            padding: 10px 12px;
          }
        }
        * { max-width: 100%; }
      </style>
      <script>
        function normalizeEmptyParagraphs() {
          document.querySelectorAll('#content-wrapper p').forEach(function(paragraph) {
            var normalized = paragraph.innerHTML
              .replace(/&nbsp;/gi, '')
              .replace(/<br\\s*\\/?\\s*>/gi, '')
              .replace(/\\s+/g, '');
            if (!normalized) {
              paragraph.classList.add('detail-empty-line');
            }
          });
        }

        function sendHeight() {
          normalizeEmptyParagraphs();
          if (window.ReactNativeWebView) {
            var wrapper = document.getElementById('content-wrapper');
            var bodyHeight = document.body.scrollHeight;
            var wrapperHeight = wrapper ? wrapper.offsetHeight : 0;
            var finalHeight = Math.max(bodyHeight, wrapperHeight, 100);
            window.ReactNativeWebView.postMessage(finalHeight.toString());
          }
        }
        window.onload = sendHeight;
        window.addEventListener('resize', sendHeight);
        document.addEventListener('loadedmetadata', sendHeight, true);
        document.addEventListener('load', sendHeight, true);

        var times = 0;
        var interval = setInterval(function() {
          sendHeight();
          times++;
          if (times > 10) clearInterval(interval); 
        }, 500);

        var observer = new MutationObserver(sendHeight);
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });

        function closestFrom(target, selector) {
          if (!target) return null;
          var element = target.nodeType === 1 ? target : target.parentElement;
          return element && element.closest ? element.closest(selector) : null;
        }

        document.addEventListener('click', function(e) {
          var pdfMenu = closestFrom(e.target, '[data-pdf-menu]');
          if (pdfMenu && window.ReactNativeWebView) {
            e.preventDefault();
            e.stopPropagation();
            var menuCard = closestFrom(pdfMenu, '.pdf-viewer-card');
            var menuUrl = pdfMenu.dataset.rawUrl || (menuCard ? menuCard.dataset.rawUrl : '');
            var menuTitle = (menuCard && menuCard.dataset.pdfTitle) || '';
            var menuSize = (menuCard && menuCard.dataset.pdfSize) || 'medium';
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'pdfMenu', url: menuUrl, title: menuTitle, size: menuSize }));
            return;
          }

          var target = closestFrom(e.target, 'a');
          if (target && target.href && window.ReactNativeWebView) {
            e.preventDefault();
            if (target.classList.contains('file-card')) {
              var titleEl = target.querySelector('.file-title');
              var title = titleEl ? titleEl.innerText : '';
              var isPdfCard = target.innerHTML.toLowerCase().includes('pdf');
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'media', mediaType: 'file', url: target.href, title: title, isPdf: isPdfCard }));
            } else {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'link', url: target.href }));
            }
            return;
          }

          var pdfOverlay = closestFrom(e.target, '.pdf-click-overlay');
          if (pdfOverlay && window.ReactNativeWebView) {
            e.preventDefault();
            var pdfCard = closestFrom(pdfOverlay, '.pdf-viewer-card');
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'media',
              mediaType: 'file',
              url: pdfOverlay.dataset.rawUrl,
              title: (pdfCard && pdfCard.dataset.pdfTitle) || 'PDF',
              isPdf: true
            }));
            return;
          }

          var mediaCard = closestFrom(e.target, '.media-card');
          if (mediaCard && window.ReactNativeWebView) {
            if (closestFrom(e.target, 'video')) {
              return;
            }
            e.preventDefault();
            e.stopPropagation();
            if (mediaCard.getAttribute('data-media-type') === 'image' || mediaCard.querySelector('img')) {
              var imgEl = mediaCard.querySelector('img');
              if (imgEl && imgEl.src) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'media', url: imgEl.src, mediaType: 'image' }));
              }
            } else if (mediaCard.getAttribute('data-media-type') === 'video' || mediaCard.querySelector('video')) {
              var videoEl = mediaCard.querySelector('video');
              if (videoEl && videoEl.src) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'media', url: videoEl.src, mediaType: 'video' }));
              }
            }
            return;
          }
        });
      </script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"></script>
      </head>
    <body>
      <div id="content-wrapper">
        ${processedContent}
      </div>
      <script>
          window.renderPdfPages = async function(card) {
            if (card.dataset.pdfRendered === 'true') return;
            const url = card.dataset.rawUrl;
            const shell = card.querySelector('.pdf-preview-shell');
            if (!shell || !url) return;
            card.dataset.pdfRendered = 'true';

            const container = shell.querySelector('.pdf-pages-container') || document.createElement('div');
            container.className = 'pdf-pages-container';
            container.onclick = function(e) {
              e.preventDefault();
              e.stopPropagation();
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'media', mediaType: 'file', url: url, title: card.dataset.pdfTitle, isPdf: true }));
              }
            };
            if (!container.parentElement) {
              shell.appendChild(container);
            }

            const isLocalPreview = /^(file|content|blob):/i.test(url);
            const pdfReadyFallbackHtml = ${JSON.stringify(pdfReadyFallbackHtml)};
            const instantFrame = shell.querySelector('.pdf-instant-frame');

            if (typeof pdfjsLib === 'undefined') {
              if (!instantFrame) {
                container.innerHTML = pdfReadyFallbackHtml;
              }
              sendHeight();
              return;
            }

            const overlay = document.createElement('div');
            overlay.className = 'pdf-click-overlay';
            overlay.dataset.rawUrl = url;
            overlay.dataset.pdfTitle = card.dataset.pdfTitle || 'PDF';
            overlay.onclick = function(e) {
              e.preventDefault();
              e.stopPropagation();
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'media', mediaType: 'file', url: url, title: card.dataset.pdfTitle, isPdf: true }));
              }
            };
            card.appendChild(overlay);

            try {
              const loadingTask = pdfjsLib.getDocument(isLocalPreview ? { url: url, disableRange: true, disableStream: true } : { url: url });
              const pdf = await loadingTask.promise;

              const page = await pdf.getPage(1);
              const pixelRatio = window.devicePixelRatio || 1;
              const viewport = page.getViewport({ scale: 1.5 });
              const canvas = document.createElement('canvas');
              canvas.className = 'pdf-page-canvas';
              const ctx = canvas.getContext('2d');
              canvas.width = Math.floor(viewport.width * pixelRatio);
              canvas.height = Math.floor(viewport.height * pixelRatio);
              canvas.style.width = '100%';
              canvas.style.height = '100%';
              canvas.style.objectFit = 'contain';

              const renderContext = {
                canvasContext: ctx,
                viewport: viewport,
                transform: [pixelRatio, 0, 0, pixelRatio, 0, 0]
              };
              await page.render(renderContext).promise;
              container.innerHTML = '';
              container.appendChild(canvas);
              if (instantFrame) instantFrame.remove();
            } catch (error) {
              console.error('PDF Error:', error);
              if (!instantFrame) {
                container.innerHTML = pdfReadyFallbackHtml;
              }
              sendHeight();
            }
          };

          function hydratePdfs() {
            Array.from(document.querySelectorAll('.pdf-viewer-card')).forEach(window.renderPdfPages);
          }
          hydratePdfs();

          function addImageClickListeners() {
            Array.from(document.querySelectorAll('.media-card[data-media-type="image"] img, .media-card img')).forEach(function(img) {
              if (img.dataset.hasClickListener) return;
              img.dataset.hasClickListener = 'true';
              img.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'media', mediaType: 'image', url: img.src }));
                }
              };
            });
          }
          addImageClickListeners();
      </script>
</body>
    </html>
  `;

  return (
    <View style={[style, Platform.OS !== 'web' && { height: webViewHeight }, Platform.OS === 'web' && { flex: 1 }]}>
      <WebView
        source={{ html: htmlContent, baseUrl: 'https://cetele.app' }}
        style={[Platform.OS !== 'web' ? { height: webViewHeight } : { flex: 1 }, { backgroundColor: 'transparent' }]}
        scrollEnabled={Platform.OS === 'web'}
        bounces={false}
        showsVerticalScrollIndicator={Platform.OS === 'web'}
        showsHorizontalScrollIndicator={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onMessage={(event) => {
          try {
            const rawData = event.nativeEvent.data;

            if (!isNaN(Number(rawData))) {
              const height = Number(rawData);
              if (height > 0) {
                setWebViewHeight(height);
              }
              return;
            }

            const data = JSON.parse(rawData);
            if (data && data.type === 'link' && data.url) {
              handleLinkPress(data.url);
            }
            if (data && data.type === 'pdfMenu' && data.url) {
              setPdfMenuTarget({
                url: data.url,
                title: data.title || getPdfFileNameFromUrl(data.url),
                size: 'medium',
              });
            }
            if (data && data.type === 'media' && data.url) {
              if (data.mediaType === 'image') {
                setPreviewImage(data.url);
              } else if (data.mediaType === 'file') {
                setPreviewDocument({ url: data.url, title: data.title, isPdf: data.isPdf });
              } else {
                if (Platform.OS === 'web') {
                  window.open(data.url, '_blank');
                } else {
                  WebBrowser.openBrowserAsync(data.url).catch(() => {
                    Linking.openURL(data.url);
                  });
                }
              }
            }
          } catch (e) {
            console.error('Error in onMessage:', e);
          }
        }}
        originWhitelist={['*']}
        allowFileAccess={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={true}
      />

      <Modal
        visible={!!previewImage}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        navigationBarTranslucent
        hardwareAccelerated
        onRequestClose={() => setPreviewImage(null)}
        supportedOrientations={['portrait', 'landscape']}
      >
        <View style={styles.previewModalContainer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            hitSlop={12}
            android_ripple={{ color: 'rgba(255,255,255,0.16)', borderless: false }}
            style={({ pressed, hovered }: any) => [
              styles.previewModalClose,
              {
                top: previewCloseTop,
                right: previewCloseRight,
                width: previewCloseSize,
                height: previewCloseSize,
                borderRadius: previewCloseSize / 2,
                opacity: pressed ? 0.72 : 1,
              },
              hovered && styles.previewModalCloseHovered,
              Platform.OS === 'web' && { cursor: 'pointer', outlineStyle: 'none' } as any,
            ]}
            onPress={() => setPreviewImage(null)}
          >
            <X size={previewCloseIconSize} color="#FFFFFF" strokeWidth={2.6} />
          </Pressable>
          {previewImage && (
            <Image
              source={{ uri: previewImage }}
              style={styles.previewModalImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      <DocumentViewer
        visible={!!previewDocument}
        url={previewDocument?.url || null}
        title={previewDocument?.title}
        isPdf={previewDocument?.isPdf}
        onClose={() => setPreviewDocument(null)}
      />

      <PdfActionSheet
        visible={!!pdfMenuTarget}
        target={pdfMenuTarget}
        onClose={() => setPdfMenuTarget(null)}
        onOpen={(target) => {
          setPreviewDocument({ url: target.url, title: target.title, isPdf: true });
        }}

        onRename={onContentChange ? handlePdfRename : undefined}
        onDelete={onContentChange ? handlePdfDelete : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  previewText: {
    fontSize: 15,
    color: '#AEAEB2',
    lineHeight: 22,
  },
  previewModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
  },
  previewModalClose: {
    position: 'absolute',
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28,28,30,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  previewModalCloseHovered: {
    backgroundColor: 'rgba(44,44,46,0.92)',
    borderColor: 'rgba(10,132,255,0.42)',
  },
  previewModalImage: {
    width: '100%',
    height: '100%',
  },
});
