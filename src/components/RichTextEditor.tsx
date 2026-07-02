import { useRef, useCallback, useState, useEffect, forwardRef, useImperativeHandle, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Keyboard,
} from 'react-native';
import { WebView, type WebViewRef } from './WebView';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { KeyboardToolbar } from './KeyboardToolbar';
import { FormatBottomSheet, type FormatBottomSheetRef } from './FormatBottomSheet';
import { DocumentViewer } from './DocumentViewer';
import { PdfActionSheet, type PdfActionTarget } from './PdfActionSheet';
import { ActionBottomSheet, type ActionBottomSheetRef, type ActionItem } from './ActionBottomSheet';
import { LinkBottomSheet, type LinkBottomSheetRef } from './LinkBottomSheet';
import {
  FormulaInputSheet,
  parseFormulaLatex,
  type FormulaSheetMode,
  type FormulaValues,
} from './PowerFormulaSheet';
import { Image as ImageIcon, File as FileIcon, Undo, Redo, Eraser, Link2 } from 'lucide-react-native';
import { nostrService } from '@/lib/nostr';
import { showAppAlert } from './AppAlertProvider';
import * as Haptics from 'expo-haptics';
import { useI18n } from '@/lib/i18n';
import { useAppTheme } from '@/lib/theme';
import { renderLatexInHtml, renderLatexMathHtml } from '@/lib/math-content';

const MEDIA_PREVIEW_CACHE_DIR_NAME = 'cetele-media-preview';

function extensionFromMediaAsset(asset: any, isVideo: boolean) {
  const fileName = String(asset?.fileName || asset?.name || asset?.uri || '');
  const fileExtension = fileName.match(/\.([a-zA-Z0-9]{2,8})(?:\?|#|$)/)?.[1]?.toLowerCase();
  if (fileExtension) return fileExtension;

  const mimeType = String(asset?.mimeType || '').toLowerCase();
  if (mimeType.includes('quicktime')) return 'mov';
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('gif')) return 'gif';
  if (mimeType.includes('heic')) return 'heic';
  if (mimeType.includes('heif')) return 'heif';
  if (mimeType.includes('webp')) return 'webp';
  return isVideo ? 'mp4' : 'jpg';
}

async function cacheMediaPreview(asset: any, isVideo: boolean, localId: string) {
  if (Platform.OS === 'web' || !asset?.uri || asset.uri.startsWith('data:')) {
    return asset?.uri;
  }

  const cacheRoot = FileSystem.cacheDirectory;
  if (!cacheRoot) return asset.uri;

  try {
    const directory = `${cacheRoot}${MEDIA_PREVIEW_CACHE_DIR_NAME}/`;
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    const destination = `${directory}${localId}.${extensionFromMediaAsset(asset, isVideo)}`;
    await FileSystem.copyAsync({ from: asset.uri, to: destination });
    return destination;
  } catch (error) {
    console.warn('Media preview cache failed:', error);
    return asset.uri;
  }
}

function getImmediateMediaPreviewUri(asset: any, isVideo: boolean) {
  if (!asset) return '';
  if (!isVideo && asset.base64) {
    const mimeType = String(asset.mimeType || 'image/jpeg').toLowerCase();
    const safeMimeType = mimeType.startsWith('image/') ? mimeType : 'image/jpeg';
    return `data:${safeMimeType};base64,${asset.base64}`;
  }
  return asset.uri;
}

function sanitizeLatexAtom(value: string, fallback: string) {
  const cleaned = value
    .trim()
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ');

  return cleaned || fallback;
}

function buildLatexPayload(tex: string) {
  const html = renderLatexMathHtml(tex, false);
  return html ? JSON.stringify({ tex, html }) : null;
}

interface RichTextEditorProps {
  initialTitle?: string;
  initialContent?: string;
  placeholder?: string;
  onTitleChange?: (title: string) => void;
  onChange?: (html: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onUploadProgress?: (progress: UploadProgressInfo | null) => void;
  style?: any;
}

export interface UploadProgressInfo {
  id: string;
  label: string;
  percent: number;
}

export interface RichTextEditorRef {
  focus: () => void;
  blur: () => void;
  insertLink: (text: string, url: string) => void;
  getContent: () => Promise<string>;
  setContent: (html: string) => void;
  setTitle: (title: string) => void;
}

const EDITOR_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
    }

    html, body {
      height: 100%;
      background-color: #000000;
      width: 100%;
      max-width: 100%;
      overflow-x: hidden;
      --editor-caret-color: #FFFFFF;
    }
    body {
      font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 17px;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      -webkit-text-size-adjust: 100%;
    }

    #note-title {
      width: 100%;
      font-size: 24px;
      font-weight: 700;
      color: #FFFFFF;
      background: transparent;
      border: none;
      outline: none;
      padding: 16px 20px 8px 20px;
      box-sizing: border-box;
      font-family: inherit;
    }
    #note-title::placeholder {
      color: #8E8E93;
    }

    #editor {
      min-height: 100%;
      padding: 0 20px 156px 20px;
      padding-bottom: calc(156px + env(safe-area-inset-bottom));
      outline: none;
      color: #FFFFFF;
      caret-color: var(--editor-caret-color);
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    #editor:empty::before {
      content: attr(data-placeholder);
      color: #636366;
      pointer-events: none;
      position: absolute;
    }

    #editor h1 {
      font-size: 28px;
      font-weight: 700;
      margin: 16px 0 8px;
      letter-spacing: -0.4px;
      line-height: 1.3;
    }

    #editor h2 {
      font-size: 22px;
      font-weight: 700;
      margin: 14px 0 6px;
      letter-spacing: -0.3px;
      line-height: 1.3;
    }

    #editor p {
      margin: 0 0 4px;
    }

    #editor p.composer-continuation {
      min-height: 36px;
      margin: 0 0 8px;
      padding: 4px 0;
    }

    #editor a {
      color: #0A84FF;
      text-decoration: underline;
    }

    #editor ul, #editor ol {
      padding-left: 24px;
      margin: 4px 0;
    }

    #editor li {
      margin: 2px 0;
    }

    #editor blockquote {
      border-left: 3px solid #0A84FF;
      padding-left: 16px;
      margin: 8px 0;
      color: #AEAEB2;
    }

    #editor code {
      font-family: "SF Mono", Menlo, monospace;
      background: rgba(255,255,255,0.08);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 15px;
    }

    #editor pre {
      background: rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 16px;
      margin: 12px 0;
      overflow-x: auto;
    }

    #editor pre code {
      background: none;
      padding: 0;
      font-size: 14px;
      color: #0A84FF;
    }

    #editor .note-table-shell, #editor .media-card, #editor .drawing-card, #editor .file-card {
      -webkit-user-select: none;
      user-select: none;
    }
    #editor .note-table-shell {
      position: relative;
      margin: 16px 0;
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 14px;
      overflow: hidden;
      background: rgba(28,28,30,0.9);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      width: 100%;
      max-width: 100%;
    }

    #editor .note-table-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      padding: 8px;
      background: rgba(44,44,46,0.9);
      border-bottom: 1px solid rgba(255,255,255,0.1);
      border-top-left-radius: 14px;
      border-top-right-radius: 14px;
      -webkit-user-select: none;
      user-select: none;
      caret-color: transparent;
    }

    #editor .note-table-control {
      appearance: none;
      border: 0;
      border-radius: 999px;
      min-height: 36px;
      padding: 8px 12px;
      color: #FFFFFF;
      background: rgba(72,72,74,0.72);
      font: 600 13px -apple-system, system-ui, sans-serif;
      cursor: pointer;
      touch-action: manipulation;
      white-space: nowrap;
      display: flex;
      align-items: center;
      justify-content: center;
      -webkit-user-select: none;
      user-select: none;
      caret-color: transparent;
    }

    #editor .note-table-control.danger {
      color: #FF453A;
      background: rgba(255,69,58,0.14);
    }

    #editor .note-table-control[data-table-action="add-row"],
    #editor .note-table-control[data-table-action="add-col"] {
      color: #FFFFFF;
      background: #0A84FF;
    }

    #editor .note-table-control-group {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      min-width: 0;
    }

    #editor .note-table-scroll {
      width: 100%;
      overflow-x: auto;
      overflow-y: visible;
      -webkit-overflow-scrolling: touch;
      border-bottom-left-radius: 14px;
      border-bottom-right-radius: 14px;
      scrollbar-width: thin;
      scrollbar-color: rgba(142,142,147,0.48) transparent;
    }

    #editor .note-table-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
    #editor .note-table-scroll::-webkit-scrollbar-track { background: transparent; }
    #editor .note-table-scroll::-webkit-scrollbar-thumb {
      background: rgba(142,142,147,0.44);
      border-radius: 999px;
    }
    #editor .note-table-scroll::-webkit-scrollbar-thumb:hover {
      background: rgba(174,174,178,0.64);
    }

    #editor .note-table-shell.is-collapsed .note-table-scroll {
      border-top-left-radius: 14px;
      border-top-right-radius: 14px;
    }

    #editor .note-table-inner {
      min-width: 100%;
      width: max-content;
      max-width: none;
    }

    #editor .note-table-column-handles {
      display: grid;
      margin-left: 36px;
      width: auto;
      min-height: 36px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      -webkit-user-select: none;
      user-select: none;
      caret-color: transparent;
    }

    #editor .note-table-row-layer {
      display: grid;
      grid-template-columns: 36px max-content;
      align-items: flex-start;
      width: max-content;
      min-width: 100%;
    }

    #editor .note-table-row-handles {
      width: 36px;
      min-width: 36px;
      border-right: 1px solid rgba(255,255,255,0.1);
      -webkit-user-select: none;
      user-select: none;
      caret-color: transparent;
    }

    #editor .note-table-handle {
      appearance: none;
      border: 0;
      outline: none;
      color: #8E8E93;
      background: rgba(44,44,46,0.92);
      font: 800 18px -apple-system, system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 36px;
      width: 36px;
      min-height: 36px;
      height: 36px;
      padding: 0;
      cursor: pointer;
      touch-action: manipulation;
      -webkit-user-select: none;
      user-select: none;
      -webkit-touch-callout: none;
      caret-color: transparent;
      box-sizing: border-box;
    }
    #editor .note-table-column-handles .note-table-handle {
      width: 100%;
      border-right: 1px solid rgba(255,255,255,0.1);
    }
    #editor .note-table-column-handles .note-table-handle:last-child {
      border-right: 0;
    }
    #editor .note-table-row-handles .note-table-handle {
      width: 36px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    #editor .note-table-row-handles .note-table-handle:last-child {
      border-bottom: 0;
    }

    #editor .note-table-handle:active,
    #editor .note-table-handle.is-open {
      color: #FFFFFF;
      background: rgba(72,72,74,0.92);
    }

    #editor .note-table-popover {
      position: absolute;
      z-index: 30;
      display: none;
      min-width: 138px;
      border-radius: 12px;
      overflow: hidden;
      background: rgba(44,44,46,0.98);
      border: 1px solid rgba(255,255,255,0.12);
      box-shadow: 0 12px 30px rgba(0,0,0,0.35);
      caret-color: transparent;
    }

    #editor .note-table-popover.is-open {
      display: block;
    }

    #editor .note-table-menu-item {
      appearance: none;
      border: 0;
      outline: none;
      width: 100%;
      padding: 12px 14px;
      text-align: left;
      color: #FF453A;
      background: transparent;
      font: 700 14px -apple-system, system-ui, sans-serif;
      cursor: pointer;
      touch-action: manipulation;
      -webkit-user-select: none;
      user-select: none;
      -webkit-touch-callout: none;
      caret-color: transparent;
    }

    #editor .note-table-menu-item:disabled {
      color: #8E8E93;
      cursor: default;
      opacity: 0.75;
    }

    #editor table.note-table {
        -webkit-user-select: text;
        user-select: text;
      width: max-content;
      min-width: 100%;
      max-width: none;
      border-collapse: separate;
      border-spacing: 0;
      table-layout: auto;
    }

    #editor .note-table td,
    #editor .note-table-cell {
      position: relative;
      ${Platform.OS === 'web' ? `
        padding: 16px 20px;
        min-width: 160px;
        border-right: 1px solid rgba(255,255,255,0.1);
        border-bottom: 1px solid rgba(255,255,255,0.1);
        font-size: 16px;
      ` : `
        padding: 10px 12px;
        min-width: 120px;
        border-right: 1px solid rgba(255,255,255,0.1);
        border-bottom: 1px solid rgba(255,255,255,0.1);
      `}
      vertical-align: top;
      outline: none;
      white-space: pre;
      word-break: normal;
      overflow-wrap: normal;
      max-width: none;
      caret-color: var(--editor-caret-color);
      color: #FFFFFF;
      background: rgba(18,18,20,0.78);
    }

    #editor .note-table td::selection,
    #editor .note-table th::selection {
      background: rgba(142,142,147,0.28);
    }

    #editor .note-table tr:first-child td,
    #editor .note-table th {
      background: rgba(44,44,46,0.82);
      font-weight: 700;
    }

    #editor .note-table td:focus,
    #editor .note-table th:focus {
      background: rgba(58,58,60,0.86);
      outline: none !important;
      box-shadow: none !important;
    }

    #editor .note-table tr:last-child td {
      border-bottom: 0;
    }

    #editor .note-table td:last-child,
    #editor .note-table th:last-child {
      border-right: 0;
    }

    #editor .media-card,
    #editor .drawing-card {
      position: relative;
      display: block;
      margin: 14px 0;
      width: 100%;
      max-width: 100%;
    }

    #editor .media-card:not(.pdf-viewer-card) {
      padding: 0;
      border: 0;
      border-radius: 14px;
      overflow: hidden;
      background: transparent;
      box-sizing: border-box;
      touch-action: manipulation;
    }

    #editor .media-card.is-uploading:not(.pdf-viewer-card) {
      opacity: 1;
      pointer-events: auto;
    }

    #editor .pdf-viewer-card {
      position: relative;
      display: block;
      width: 100%;
      max-width: 100%;
      margin: 14px 0 18px;
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.1);
      background: #1C1C1E;
      box-shadow: 0 14px 40px rgba(0,0,0,0.24);
    }

    #editor .pdf-card-header {
      position: relative;
      z-index: 5;
      min-height: 42px;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 8px 8px 12px;
      background: rgba(28,28,30,0.92);
      border-bottom: 1px solid rgba(255,255,255,0.08);
      -webkit-user-select: none;
      user-select: none;
      caret-color: transparent;
    }

    #editor .pdf-title {
      min-width: 0;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #FFFFFF;
      font: 600 14px -apple-system, system-ui, sans-serif;
      pointer-events: none;
    }

    #editor .pdf-card-header .block-remove-button {
      position: relative;
      top: auto;
      right: auto;
      flex: 0 0 auto;
      width: 30px;
      height: 30px;
      min-height: 30px;
      padding: 0;
      margin: 0;
      background: rgba(58,58,60,0.86);
      box-shadow: none;
    }

    #editor .file-menu-button {
      appearance: none;
      border: 0;
      border-radius: 999px;
      width: 30px;
      height: 30px;
      min-height: 30px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(10,132,255,0.14);
      touch-action: manipulation;
      cursor: pointer;
      -webkit-user-select: none;
      user-select: none;
      caret-color: transparent;
      flex: 0 0 auto;
    }

    #editor .file-menu-button::before {
      content: '';
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: #0A84FF;
      box-shadow: -7px 0 0 #0A84FF, 7px 0 0 #0A84FF;
    }

    #editor .file-card .file-menu-button {
      position: absolute;
      top: 10px;
      right: 46px;
      z-index: 5;
    }

    #editor .pdf-preview-shell {
      position: relative;
      width: 100%;
      aspect-ratio: 4 / 3;
      min-height: min(220px, 58vw);
      max-height: min(58vh, 520px);
      background: #000000;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    #editor .pdf-preview-shell iframe {
      position: relative;
      z-index: 1;
      width: 100%;
      height: 100%;
      border: 0;
      background: #FFFFFF;
      pointer-events: none;
    }

    #editor .pdf-click-overlay {
      position: absolute;
      z-index: 2;
      inset: 0;
      cursor: pointer;
      background: transparent;
    }

    #editor .media-frame {
      width: 100%;
      display: block;
      overflow: hidden;
      border-radius: 14px;
      background: transparent;
    }

    #editor .file-card {
      position: relative;
      margin: 14px 0;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 14px;
      overflow: hidden;
      background: rgba(28,28,30,0.86);
    }

    #editor .block-remove-button {
      appearance: none;
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 4;
      border: 0;
      border-radius: 999px;
      width: 28px;
      height: 28px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(28,28,30,0.7);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      cursor: pointer;
      touch-action: manipulation;
      -webkit-user-select: none;
      user-select: none;
      caret-color: transparent;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    #editor .block-remove-button::before,
    #editor .block-remove-button::after {
      content: '';
      position: absolute;
      width: 14px;
      height: 2px;
      background-color: #FFFFFF;
      border-radius: 1px;
    }
    #editor .block-remove-button::before { transform: rotate(45deg); }
    #editor .block-remove-button::after { transform: rotate(-45deg); }

    #editor .drawing-card svg {
      display: block !important;
      width: 100% !important;
      height: auto !important;
      max-width: 100% !important;
      background: transparent !important;
      border-radius: 20px;
    }

    #editor .media-card img {
      display: block;
      width: 100%;
      height: auto;
      max-width: 100%;
      max-height: none;
      object-fit: contain;
      background: transparent;
      border-radius: 14px;
    }

    #editor .media-card video {
      display: block;
      width: 100%;
      height: auto;
      max-width: 100%;
      max-height: none;
      object-fit: contain;
      background: #000;
      border-radius: 14px;
    }

    #editor .media-card > img,
    #editor .media-card > video {
      height: auto;
      max-height: none;
    }

    #editor .media-frame > img,
    #editor .media-frame > video {
      height: auto;
    }

    #editor .media-caption,
    #editor .file-title,
    #editor .file-meta,
    #editor .drawing-placeholder {
      padding: 10px 12px;
    }

    #editor .media-caption {
      display: none;
    }

    #editor .file-card {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 180px;
      margin: 16px 0;
      text-decoration: none;
      color: #FFFFFF;
      border-radius: 20px;
      overflow: hidden;
      background: rgba(28,28,30,0.86);
      border: 1px solid rgba(255,255,255,0.08);
      -webkit-user-select: none;
      user-select: none;
    }

    #editor .file-icon-placeholder {
      width: 44px;
      height: 56px;
      background: rgba(10, 132, 255, 0.15);
      border: 2px solid #0A84FF;
      border-radius: 6px;
      position: relative;
      margin-bottom: 12px;
      margin-top: 16px;
    }
    #editor .file-icon-placeholder::after {
      content: '';
      position: absolute;
      top: -2px;
      right: -2px;
      border-width: 0 16px 16px 0;
      border-style: solid;
      border-color: rgba(28,28,30,0.86) rgba(28,28,30,0.86) #0A84FF #0A84FF;
      border-bottom-left-radius: 4px;
      display: block;
      width: 0;
    }

    #editor .file-title {
      font-weight: 600;
      font-size: 16px;
      text-align: center;
      color: #FFFFFF;
      padding: 0 16px;
      max-width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    #editor .file-meta {
      font-size: 13px;
      color: #8E8E93;
      margin-top: 6px;
      margin-bottom: 16px;
    }

    #editor .drawing-placeholder {
      min-height: 180px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #8E8E93;
      background:
        linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
      background-size: 22px 22px;
    }

    #editor .drawing-card {
      display: block;
      width: 100%;
      max-width: 100%;
      padding: 10px;
      background: rgba(17,17,19,0.95);
      border-radius: 20px;
      overflow: hidden;
      -webkit-user-select: none;
      user-select: none;
      -webkit-touch-callout: none;
      touch-action: manipulation;
    }

    #editor .drawing-toolbar {
      position: relative;
      z-index: 5;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding-bottom: 10px;
      -webkit-user-select: none;
      user-select: none;
      caret-color: transparent;
      pointer-events: auto;
    }

    #editor .drawing-toolbar * {
      pointer-events: auto;
    }

    #editor .drawing-tool-group {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    #editor .drawing-color,
    #editor .drawing-action {
      appearance: none;
      border: 0;
      color: #FFFFFF;
      font: 700 13px -apple-system, system-ui, sans-serif;
      background: rgba(255,255,255,0.1);
      -webkit-user-select: none;
      user-select: none;
      caret-color: transparent;
    }

    #editor .drawing-color {
      border: 2px solid rgba(255,255,255,0.24);
      min-width: 30px;
      height: 30px;
      border-radius: 15px;
    }

    #editor .drawing-color.is-active {
      border-color: #0A84FF;
      box-shadow: 0 0 0 2px rgba(10,132,255,0.22);
    }

    #editor .drawing-action {
      padding: 0 10px;
      width: auto;
      min-height: 34px;
      border-radius: 17px;
      cursor: pointer;
      touch-action: manipulation;
      white-space: nowrap;
      display: flex;
      align-items: center;
      justify-content: center;
      -webkit-user-select: none;
      user-select: none;
      caret-color: transparent;
    }

    #editor .drawing-action.danger {
      color: #FF453A;
      background: rgba(255,69,58,0.14);
    }

    #editor .drawing-action.primary {
      background: rgba(10,132,255,0.32);
      color: #FFFFFF;
    }

    #editor .drawing-surface {
      position: relative;
      z-index: 1;
      width: 100%;
      aspect-ratio: 4 / 3;
      min-height: 220px;
      max-height: 58vh;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.12);
      background:
        linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px),
        #111113;
      background-size: 24px 24px;
      touch-action: none;
      -webkit-user-select: none;
      user-select: none;
      -webkit-touch-callout: none;
    }

    #editor .drawing-canvas {
      display: block;
      width: 100%;
      height: 100%;
      touch-action: none;
      pointer-events: auto;
      -webkit-user-select: none;
      user-select: none;
      -webkit-touch-callout: none;
    }

    #editor .drawing-image {
      display: none;
      width: 100%;
      border-radius: 12px;
      background: #111113;
    }

    @media (max-width: 430px) {
      #editor {
        padding-left: 16px;
        padding-right: 16px;
        padding-bottom: 148px;
        padding-bottom: calc(148px + env(safe-area-inset-bottom));
      }

      #editor table.note-table {
        -webkit-user-select: text;
        user-select: text;
        min-width: 320px;
      }

      #editor .note-table-control {
        flex: 1 0 auto;
      }

      #editor .block-remove-button {
        min-height: 32px;
        padding: 6px 10px;
      }

      #editor .note-table td,
      #editor .note-table th {
        min-width: 96px;
        padding: 10px 12px;
      }
    }

    ::selection {
      background: rgba(10, 132, 255, 0.3);
    }

    html, body {
      scrollbar-width: none;
    }

    /* Custom Web Scrollbar */
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #2C2C2E; border-radius: 999px; }
    ::-webkit-scrollbar-thumb:hover { background: #3A3A3C; }
    html::-webkit-scrollbar,
    body::-webkit-scrollbar {
      display: none;
      width: 0;
      height: 0;
    }
    #editor-scroll-indicator {
      position: fixed;
      top: 4px;
      right: 1px;
      width: 2px;
      height: 32px;
      border-radius: 999px;
      background: #2C2C2E;
      opacity: 0;
      pointer-events: none;
      z-index: 9999;
      will-change: transform, height, opacity;
    }
  </style>
</head>
<body>
  <input type="text" id="note-title" placeholder="Başlık" autocomplete="off" value="" />
  <div id="editor" contenteditable="true" data-placeholder="Yazmaya başlayın..."></div>
  <div id="editor-scroll-indicator"></div>

  <script>
    const editor = document.getElementById('editor');
    const titleInput = document.getElementById('note-title');
    const editorScrollIndicator = document.getElementById('editor-scroll-indicator');
    titleInput.addEventListener('input', () => {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'titleChange', title: titleInput.value }));
    });
    titleInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        editor.focus({ preventScroll: true });
      }
    });
    const ATOMIC_BLOCK_SELECTOR = '.media-card, .file-card, .drawing-card, .note-table-shell';
    let lastContent = '';
    let savedRange = null;
    let pendingColor = null;
    let caretTimerShort = null;
    let caretTimerLong = null;
    let caretTimerFinal = null;
    let lastContinuationFocusAt = 0;
    let activeCaretElement = null;
    let selectedMathAtom = null;

    function saveSelection() {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return;
      }

      const range = selection.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        savedRange = range.cloneRange();
      }
    }

    function restoreSelection() {
      if (!savedRange) {
        editor.focus();
        if (isEditorEmpty()) {
          placeCaretInNode(editor);
          window.scrollTo({ top: 0, behavior: 'auto' });
        } else {
          placeCaretInNode(editor, true);
        }
        return;
      }

      try {
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(savedRange);
      } catch (error) {
        savedRange = null;
        editor.focus();
      }
    }

    function escapeHtml(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function escapeAttr(value) {
      return escapeHtml(value).replace(/\\n/g, ' ');
    }

    function insertHtmlAtSelection(html) {
      restoreSelection();
      document.execCommand('insertHTML', false, html);
      saveSelection();
      requestAnimationFrame(syncAllTables);
      requestAnimationFrame(hydrateDrawings);
      notifyChange();
      requestAnimationFrame(updateScrollShadows);
    }

    function normalizeLatexAtom(value, fallback) {
      var cleaned = String(value || '')
        .trim()
        .replace(/[{}]/g, '')
        .replace(/\s+/g, ' ');
      return cleaned || fallback;
    }

    function buildPowerMathHtml(base, exponent) {
      var safeBase = normalizeLatexAtom(base, 'x');
      var safeExponent = normalizeLatexAtom(exponent, '2');
      var tex = safeBase + '^{' + safeExponent + '}';
      return '<span class="math-inline" data-latex="' + escapeAttr(tex) + '" contenteditable="false">' +
        '<math xmlns="http://www.w3.org/1998/Math/MathML"><msup><mrow><mtext>' +
        escapeHtml(safeBase) +
        '</mtext></mrow><mrow><mtext>' +
        escapeHtml(safeExponent) +
        '</mtext></mrow></msup></math></span>';
    }

    function consumeLatexBaseBeforeCaret() {
      restoreSelection();
      var selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return 'x';
      var range = selection.getRangeAt(0);

      if (!range.collapsed) {
        var selected = selection.toString().trim();
        document.execCommand('delete', false, null);
        saveSelection();
        return normalizeLatexAtom(selected, 'x');
      }

      function lastTextNodeIn(root) {
        if (!root) return null;
        if (root.nodeType === Node.TEXT_NODE) return root;
        for (var i = root.childNodes.length - 1; i >= 0; i -= 1) {
          var found = lastTextNodeIn(root.childNodes[i]);
          if (found) return found;
        }
        return null;
      }

      var node = selection.anchorNode;
      var offset = selection.anchorOffset || 0;
      var textNode = node && node.nodeType === Node.TEXT_NODE ? node : null;
      var textOffset = offset;

      if (!textNode && node && node.nodeType === Node.ELEMENT_NODE) {
        for (var childIndex = Math.min(offset - 1, node.childNodes.length - 1); childIndex >= 0; childIndex -= 1) {
          textNode = lastTextNodeIn(node.childNodes[childIndex]);
          if (textNode) {
            textOffset = textNode.textContent ? textNode.textContent.length : 0;
            break;
          }
        }
      }

      if (textNode) {
        var text = textNode.textContent || '';
        var before = text.slice(0, textOffset).replace(/\u00a0/g, ' ');
        var match = before.match(/([0-9A-Za-z._-]+)$/);
        if (match && match[1]) {
          var deleteRange = document.createRange();
          deleteRange.setStart(textNode, textOffset - match[1].length);
          deleteRange.setEnd(textNode, textOffset);
          deleteRange.deleteContents();
          selection.removeAllRanges();
          selection.addRange(deleteRange);
          saveSelection();
          return normalizeLatexAtom(match[1], 'x');
        }
      }

      return 'x';
    }

    function insertRenderedLatexPayload(value) {
      if (!value) return;
      try {
        var payload = JSON.parse(value);
        if (payload && payload.html) {
          restoreSelection();
          var selection = window.getSelection();
          var leadingSpace = '';
          try {
            if (selection && selection.rangeCount > 0) {
              var insertionRange = selection.getRangeAt(0);
              var beforeRange = insertionRange.cloneRange();
              beforeRange.selectNodeContents(editor);
              beforeRange.setEnd(insertionRange.startContainer, insertionRange.startOffset);
              var textBefore = beforeRange.toString().replace(/\u200b/g, '');
              if (textBefore && !/[\s([{]$/.test(textBefore)) {
                leadingSpace = '&nbsp;';
              }
            }
          } catch (spacingError) {}
          insertHtmlAtSelection(leadingSpace + payload.html + '&nbsp;');
        }
      } catch (error) {}
    }

    function clearSelectedMathAtom() {
      if (selectedMathAtom) {
        selectedMathAtom.classList.remove('is-selected');
        selectedMathAtom = null;
      }
    }

    function selectMathAtom(atom) {
      if (!atom) return;
      if (selectedMathAtom && selectedMathAtom !== atom) {
        selectedMathAtom.classList.remove('is-selected');
      }
      selectedMathAtom = atom;
      selectedMathAtom.classList.add('is-selected');
      editor.focus({ preventScroll: true });
      var range = document.createRange();
      range.setStartAfter(atom);
      range.collapse(true);
      var selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      savedRange = range.cloneRange();
      getActiveStyles();
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'haptic', style: 'selection' }));
    }

    function getMathFormatState(atom, format) {
      if (!atom) return false;
      var explicit = atom.getAttribute('data-format-' + format);
      if (explicit === 'on') return true;
      if (explicit === 'off') return false;
      var computed = window.getComputedStyle(atom);
      if (format === 'bold') return Number.parseInt(computed.fontWeight, 10) >= 600 || computed.fontWeight === 'bold';
      if (format === 'italic') return computed.fontStyle === 'italic' || computed.fontStyle === 'oblique';
      if (format === 'underline') return computed.textDecorationLine.indexOf('underline') !== -1;
      if (format === 'strike') return computed.textDecorationLine.indexOf('line-through') !== -1;
      return false;
    }

    function toggleMathFormat(atom, format) {
      var nextActive = !getMathFormatState(atom, format);
      atom.setAttribute('data-format-' + format, nextActive ? 'on' : 'off');
      if (format === 'bold') atom.style.fontWeight = nextActive ? '700' : '400';
      if (format === 'italic') atom.style.fontStyle = nextActive ? 'italic' : 'normal';
      if (format === 'underline' || format === 'strike') {
        var decorations = [];
        if (format === 'underline' ? nextActive : getMathFormatState(atom, 'underline')) decorations.push('underline');
        if (format === 'strike' ? nextActive : getMathFormatState(atom, 'strike')) decorations.push('line-through');
        atom.style.textDecorationLine = decorations.length ? decorations.join(' ') : 'none';
      }
    }

    function clearMathFormatting(atom) {
      ['bold', 'italic', 'underline', 'strike'].forEach(function(format) {
        atom.removeAttribute('data-format-' + format);
      });
      atom.style.removeProperty('font-weight');
      atom.style.removeProperty('font-style');
      atom.style.removeProperty('text-decoration-line');
      atom.style.removeProperty('color');
      if (!atom.getAttribute('style')) atom.removeAttribute('style');
    }

    function applyMathFormattingCommand(command, value) {
      if (!selectedMathAtom || !editor.contains(selectedMathAtom)) return false;
      if (command === 'bold') toggleMathFormat(selectedMathAtom, 'bold');
      else if (command === 'italic') toggleMathFormat(selectedMathAtom, 'italic');
      else if (command === 'underline') toggleMathFormat(selectedMathAtom, 'underline');
      else if (command === 'strikethrough') toggleMathFormat(selectedMathAtom, 'strike');
      else if (command === 'foreColor' && value) selectedMathAtom.style.color = value;
      else if (command === 'removeFormat') clearMathFormatting(selectedMathAtom);
      else return false;

      notifyChange();
      getActiveStyles();
      return true;
    }

    function openMathAtomEditor(atom) {
      var tex = atom ? atom.getAttribute('data-latex') : '';
      if (!tex) return false;
      selectMathAtom(atom);
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'editFormula',
        tex: tex
      }));
      return true;
    }

    function removeSelectedMathAtom() {
      if (!selectedMathAtom || !editor.contains(selectedMathAtom)) {
        clearSelectedMathAtom();
        return false;
      }

      var parent = selectedMathAtom.parentNode;
      var removalIndex = parent ? Array.prototype.indexOf.call(parent.childNodes, selectedMathAtom) : -1;
      var next = selectedMathAtom.nextSibling;
      selectedMathAtom.remove();
      selectedMathAtom = null;
      if (next && next.nodeType === Node.TEXT_NODE) {
        next.textContent = String(next.textContent || '').replace(/^[\u00a0\s]+/, '');
        if (!next.textContent) next.remove();
      }
      if (parent && removalIndex >= 0) {
        var range = document.createRange();
        range.setStart(parent, Math.min(removalIndex, parent.childNodes.length));
        range.collapse(true);
        var selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        savedRange = range.cloneRange();
      }
      notifyChange();
      updateScrollShadows();
      return true;
    }

    function replaceSelectedLatexPayload(value) {
      if (!value) return;
      if (!selectedMathAtom || !editor.contains(selectedMathAtom)) {
        insertRenderedLatexPayload(value);
        return;
      }

      try {
        var payload = JSON.parse(value);
        if (!payload || !payload.html) return;
        var markerId = 'math-replace-' + Date.now() + '-' + Math.random().toString(36).slice(2);
        var preservedStyle = selectedMathAtom.getAttribute('style');
        var preservedFormats = ['bold', 'italic', 'underline', 'strike'].map(function(format) {
          return [format, selectedMathAtom.getAttribute('data-format-' + format)];
        });
        selectedMathAtom.insertAdjacentHTML('afterend', payload.html + '&nbsp;<span data-math-marker="' + markerId + '"></span>');
        var oldAtom = selectedMathAtom;
        var newAtom = oldAtom.nextElementSibling;
        if (newAtom && newAtom.matches('.math-inline, .math-display')) {
          if (preservedStyle) newAtom.setAttribute('style', preservedStyle);
          preservedFormats.forEach(function(entry) {
            if (entry[1]) newAtom.setAttribute('data-format-' + entry[0], entry[1]);
          });
        }
        selectedMathAtom = null;
        oldAtom.remove();
        var marker = editor.querySelector('[data-math-marker="' + markerId + '"]');
        if (marker) {
          var range = document.createRange();
          range.setStartAfter(marker);
          range.collapse(true);
          var selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          marker.remove();
          saveSelection();
        }
        notifyChange();
        updateScrollShadows();
      } catch (error) {}
    }

    function insertAtomicBlockAtSelection(html) {
      const markerId = 'insert-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      restoreSelection();
      moveSelectionOutsideAtomicBlock();
      document.execCommand('insertHTML', false, html + '<span data-insert-marker="' + markerId + '"></span>');

      const marker = editor.querySelector('[data-insert-marker="' + markerId + '"]');
      let block = marker ? marker.previousElementSibling : null;
      if (block && !block.matches(ATOMIC_BLOCK_SELECTOR)) {
        block = block.closest(ATOMIC_BLOCK_SELECTOR);
      }

      if (block && block.matches(ATOMIC_BLOCK_SELECTOR)) {
        block = promoteAtomicBlockToEditorRoot(block);
      }

      if (marker) {
        marker.remove();
      }

      if (block && block.matches(ATOMIC_BLOCK_SELECTOR)) {
        placeCaretInNode(ensureParagraphAfter(block));
      } else {
        saveSelection();
      }

      requestAnimationFrame(syncAllTables);
      requestAnimationFrame(hydrateDrawings);
      requestAnimationFrame(scrollToCaret);
      notifyChange();
      requestAnimationFrame(updateScrollShadows);
    }

    function formatBytes(size) {
      const bytes = Number(size || 0);
      if (!bytes) return '';
      const units = ['B', 'KB', 'MB', 'GB'];
      const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
      const value = bytes / Math.pow(1024, index);
      return value.toFixed(value >= 10 || index === 0 ? 0 : 1) + ' ' + units[index];
    }

    function buildTable(rows, cols) {
      const rowCount = Math.max(Number(rows) || 2, 1);
      const colCount = Math.max(Number(cols) || 2, 1);
      let tableRows = '';

      for (let row = 0; row < rowCount; row += 1) {
        let cells = '';
        for (let col = 0; col < colCount; col += 1) {
          cells += '<td contenteditable="true"><br></td>';
        }
        tableRows += '<tr>' + cells + '</tr>';
      }

      return '<div class="note-table-shell" contenteditable="false">' +
        '<div class="note-table-controls">' +
        '<div class="note-table-control-group">' +
        '<button type="button" contenteditable="false" class="note-table-control" data-table-action="add-row">' + ICONS.rowPlus + '</button>' +
        '<button type="button" contenteditable="false" class="note-table-control" data-table-action="add-col">' + ICONS.colPlus + '</button>' +
        '</div>' +
        '<div class="note-table-control-group">' +
        '<button type="button" contenteditable="false" class="note-table-control danger" data-table-action="delete-table">' + ICONS.trash + '</button>' +
        '<button type="button" contenteditable="false" class="note-table-control" data-table-action="close-menu">' + ICONS.check + '</button>' +
        '</div>' +
        '</div>' +
        '<div class="note-table-scroll">' +
        '<div class="note-table-inner">' +
        '<div class="note-table-column-handles"></div>' +
        '<div class="note-table-row-layer">' +
        '<div class="note-table-row-handles"></div>' +
        '<table class="note-table" contenteditable="true"><tbody>' + tableRows + '</tbody></table>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div class="note-table-popover"><button type="button" tabindex="-1" contenteditable="false" class="note-table-menu-item"></button></div>' +
        '</div>';
    }

    function getTableMetrics(table) {
      const rows = Array.from(table.rows);
      const firstRow = rows[0];
      const colCount = firstRow ? firstRow.cells.length : 0;
      const colWidths = firstRow ? Array.from(firstRow.cells).map(cell => cell.getBoundingClientRect().width) : [];
      const tableWidth = table.getBoundingClientRect().width;

      return { rows: rows, colCount: colCount, colWidths: colWidths, tableWidth: tableWidth };
    }

    function ensureTableChrome(shell) {
      const scroll = shell.querySelector('.note-table-scroll');
      const table = shell.querySelector('table.note-table');
      if (!scroll || !table) return;

      table.setAttribute('contenteditable', 'true');
      Array.from(table.querySelectorAll('td, th')).forEach(function(cell) {
        cell.setAttribute('contenteditable', 'true');
      });

      let controls = shell.querySelector('.note-table-controls');
      if (!controls) {
        controls = document.createElement('div');
        controls.className = 'note-table-controls';
        shell.insertBefore(controls, scroll);
      }

      if (!controls.querySelector('[data-table-action="close-menu"]') || !controls.querySelector('[data-table-action="delete-table"]')) {
        controls.innerHTML = '<div class="note-table-control-group"><button type="button" contenteditable="false" class="note-table-control" data-table-action="add-row">+ Satır</button><button type="button" contenteditable="false" class="note-table-control" data-table-action="add-col">+ Sütun</button></div><div class="note-table-control-group"><button type="button" contenteditable="false" class="note-table-control danger" data-table-action="delete-table">' + ICONS.trash + '</button><button type="button" contenteditable="false" class="note-table-control" data-table-action="close-menu">' + ICONS.check + '</button></div>';
      }

      if (!scroll.querySelector('.note-table-inner')) {
        const inner = document.createElement('div');
        inner.className = 'note-table-inner';
        const columnHandles = document.createElement('div');
        columnHandles.className = 'note-table-column-handles';
        const rowLayer = document.createElement('div');
        rowLayer.className = 'note-table-row-layer';
        const rowHandles = document.createElement('div');
        rowHandles.className = 'note-table-row-handles';
        table.parentNode.insertBefore(inner, table);
        inner.appendChild(columnHandles);
        inner.appendChild(rowLayer);
        rowLayer.appendChild(rowHandles);
        rowLayer.appendChild(table);
      }

      if (!shell.querySelector('.note-table-popover')) {
        const popover = document.createElement('div');
        popover.className = 'note-table-popover';
        popover.innerHTML = '<button type="button" tabindex="-1" contenteditable="false" class="note-table-menu-item"></button>';
        shell.appendChild(popover);
      }
    }

    function syncTableHandles(shell) {
      ensureTableChrome(shell);
      const table = shell.querySelector('table.note-table');
      const columnHandles = shell.querySelector('.note-table-column-handles');
      const rowHandles = shell.querySelector('.note-table-row-handles');
      const inner = shell.querySelector('.note-table-inner');
      if (!table || !columnHandles || !rowHandles || !inner) return;

      const metrics = getTableMetrics(table);
      inner.style.width = (metrics.tableWidth + 36) + 'px';
      columnHandles.style.width = metrics.tableWidth + 'px';
      columnHandles.style.gridTemplateColumns = metrics.colWidths.map(function(width) {
        return Math.max(width, 0) + 'px';
      }).join(' ');
      const rowLayer = shell.querySelector('.note-table-row-layer');
      if (rowLayer) {
        rowLayer.style.width = (metrics.tableWidth + 36) + 'px';
        rowLayer.style.gridTemplateColumns = '36px ' + metrics.tableWidth + 'px';
      }

      if (columnHandles.children.length !== metrics.colCount) {
        columnHandles.innerHTML = '';
        for (let col = 0; col < metrics.colCount; col += 1) {
          const button = document.createElement('button');
          button.type = 'button';
          button.tabIndex = -1;
          button.contentEditable = 'false';
          button.className = 'note-table-handle';
          button.dataset.tableMenu = 'col';
          button.dataset.index = String(col);
          button.innerHTML = '&#8943;';
          columnHandles.appendChild(button);
        }
      }

      if (rowHandles.children.length !== metrics.rows.length) {
        rowHandles.innerHTML = '';
        metrics.rows.forEach(function(row, index) {
          const button = document.createElement('button');
          button.type = 'button';
          button.tabIndex = -1;
          button.contentEditable = 'false';
          button.className = 'note-table-handle';
          button.dataset.tableMenu = 'row';
          button.dataset.index = String(index);
          button.innerHTML = '&#8942;';
          button.style.height = row.getBoundingClientRect().height + 'px';
          rowHandles.appendChild(button);
        });
      } else {
        metrics.rows.forEach(function(row, index) {
          const button = rowHandles.children[index];
          if (button) {
            button.style.height = row.getBoundingClientRect().height + 'px';
          }
        });
      }
    }

    function syncAllTables() {
      Array.from(editor.querySelectorAll('.note-table-shell')).forEach(syncTableHandles);
    }

    function hideTableMenus() {
      Array.from(editor.querySelectorAll('.note-table-popover.is-open')).forEach(function(popover) {
        popover.classList.remove('is-open');
      });
      Array.from(editor.querySelectorAll('.note-table-handle.is-open')).forEach(function(handle) {
        handle.classList.remove('is-open');
      });
    }

    function showTableMenu(shell, button) {
      hideTableMenus();
      const popover = shell.querySelector('.note-table-popover');
      const menuItem = popover ? popover.querySelector('.note-table-menu-item') : null;
      if (!popover || !menuItem) return;

      const type = button.dataset.tableMenu;
      const index = Number(button.dataset.index || 0);
      const table = shell.querySelector('table.note-table');
      const colCount = table?.rows[0]?.cells.length || 0;
      const rowCount = table?.rows.length || 0;
      const canDelete = type === 'row' ? rowCount > 1 : colCount > 1;
      const shellRect = shell.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      popover.dataset.type = type;
      popover.dataset.index = String(index);
      menuItem.disabled = !canDelete;
      menuItem.textContent = canDelete
        ? (type === 'row' ? 'Satırı Sil' : 'Sütunu Sil')
        : (type === 'row' ? 'Son satır silinemez' : 'Son sütun silinemez');
      
      popover.style.left = Math.min(Math.max(buttonRect.left - shellRect.left, 8), Math.max(shellRect.width - 146, 8)) + 'px';
      
      let topPos;
      if (type === 'row') {
        topPos = buttonRect.top - shellRect.top + (buttonRect.height / 2) - 22;
        topPos = Math.max(48, Math.min(topPos, shellRect.height - 50));
      } else {
        topPos = buttonRect.bottom - shellRect.top + 6;
      }
      popover.style.top = topPos + 'px';
      
      popover.classList.add('is-open');
      button.classList.add('is-open');
    }

    function deleteTablePart(shell, type, index) {
      const table = shell.querySelector('table.note-table');
      if (!table) return;
      let didDelete = false;

      if (type === 'row' && table.rows.length > 1) {
        table.deleteRow(index);
        didDelete = true;
      }

      if (type === 'col') {
        const colCount = table.rows[0]?.cells.length || 0;
        if (colCount > 1) {
          Array.from(table.rows).forEach(function(row) {
            if (row.cells[index]) {
              row.deleteCell(index);
            }
          });
          didDelete = true;
        }
      }

      hideTableMenus();
      if (!didDelete) return;
      syncTableHandles(shell);
      notifyChange();
    }

    function placeCaretInNode(node, atEnd) {
      if (!node) return;
      try {
        editor.focus({ preventScroll: true });
      } catch (error) {
        editor.focus();
      }
      const range = document.createRange();
      const selection = window.getSelection();
      if (!selection) return;
      range.selectNodeContents(node);
      range.collapse(!atEnd);
      selection.removeAllRanges();
      selection.addRange(range);
      savedRange = range.cloneRange();
      editor.focus();
    }

    function ensureParagraphAfter(block) {
      let paragraph = block.nextElementSibling;
      if (!paragraph || paragraph.tagName.toLowerCase() !== 'p') {
        paragraph = document.createElement('p');
        paragraph.innerHTML = '<br>';
        block.parentNode.insertBefore(paragraph, block.nextSibling);
      }

      if (!paragraph.innerHTML.trim()) {
        paragraph.innerHTML = '<br>';
      }

      if (!paragraph.textContent.replace(/\u200b/g, '').trim()) {
        paragraph.classList.add('composer-continuation');
      }

      return paragraph;
    }

    function moveSelectionOutsideAtomicBlock() {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return false;
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const element = container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement;
      const atomicBlock = element && element.closest ? element.closest(ATOMIC_BLOCK_SELECTOR) : null;
      if (!atomicBlock || !editor.contains(atomicBlock)) return false;
      placeCaretInNode(ensureParagraphAfter(atomicBlock));
      return true;
    }

    function promoteAtomicBlockToEditorRoot(block) {
      if (!block || !editor.contains(block) || block.parentNode === editor) return block;
      let rootChild = block;
      while (rootChild.parentNode && rootChild.parentNode !== editor) {
        rootChild = rootChild.parentNode;
      }
      if (rootChild.parentNode === editor) {
        editor.insertBefore(block, rootChild.nextSibling);
      }
      return block;
    }

    function normalizeAtomicContinuations() {
      Array.from(editor.querySelectorAll(ATOMIC_BLOCK_SELECTOR)).forEach(function(block) {
        promoteAtomicBlockToEditorRoot(block);
      });
      Array.from(editor.querySelectorAll(ATOMIC_BLOCK_SELECTOR)).forEach(function(block) {
        ensureParagraphAfter(block);
      });
    }

    function placeCaretAfterTable(shell) {
      placeCaretInNode(ensureParagraphAfter(shell));
    }

    function removeAtomicBlock(block) {
      const paragraph = ensureParagraphAfter(block);
      block.remove();
      placeCaretInNode(paragraph);
      notifyChange();
      requestAnimationFrame(syncAllTables);
      requestAnimationFrame(updateScrollShadows);
    }

    const ICONS = {
      undo: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>',
      clear: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>',
      trash: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
      check: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
      rowPlus: '<span style="display:flex;align-items:center;gap:4px"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>Satır</span>',
      colPlus: '<span style="display:flex;align-items:center;gap:4px"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>Sütun</span>'
    };

    function buildDrawing() {
      return '<figure class="drawing-card" contenteditable="false" data-media-type="drawing">' +
        '<div class="drawing-toolbar">' +
        '<div class="drawing-tool-group">' +
        '<button type="button" contenteditable="false" class="drawing-color is-active" data-drawing-color="#FFFFFF" style="background:#FFFFFF"></button>' +
        '<button type="button" contenteditable="false" class="drawing-color" data-drawing-color="#0A84FF" style="background:#0A84FF"></button>' +
        '<button type="button" contenteditable="false" class="drawing-color" data-drawing-color="#FF453A" style="background:#FF453A"></button>' +
        '</div>' +
        '<div class="drawing-tool-group">' +
        '<button type="button" contenteditable="false" class="drawing-action" data-drawing-action="undo">' + ICONS.undo + '</button>' +
        '<button type="button" contenteditable="false" class="drawing-action" data-drawing-action="clear">' + ICONS.clear + '</button>' +
        '<button type="button" contenteditable="false" class="drawing-action danger" data-drawing-action="delete">' + ICONS.trash + '</button>' +
        '<button type="button" contenteditable="false" class="drawing-action primary" data-drawing-action="done">' + ICONS.check + '</button>' +
        '</div>' +
        '</div>' +
        '<div class="drawing-surface">' +
        '<canvas class="drawing-canvas" width="1200" height="900"></canvas>' +
        '</div>' +
        '<img class="drawing-image" alt="Çizim" data-drawing-src="" />' +
        '</figure>';
    }

    function getDrawingToolbarHtml() {
      return '<div class="drawing-toolbar">' +
        '<div class="drawing-tool-group">' +
        '<button type="button" contenteditable="false" class="drawing-color is-active" data-drawing-color="#FFFFFF" style="background:#FFFFFF"></button>' +
        '<button type="button" contenteditable="false" class="drawing-color" data-drawing-color="#0A84FF" style="background:#0A84FF"></button>' +
        '<button type="button" contenteditable="false" class="drawing-color" data-drawing-color="#FF453A" style="background:#FF453A"></button>' +
        '</div>' +
        '<div class="drawing-tool-group">' +
        '<button type="button" contenteditable="false" class="drawing-action" data-drawing-action="undo">' + ICONS.undo + '</button>' +
        '<button type="button" contenteditable="false" class="drawing-action" data-drawing-action="clear">' + ICONS.clear + '</button>' +
        '<button type="button" contenteditable="false" class="drawing-action danger" data-drawing-action="delete">' + ICONS.trash + '</button>' +
        '<button type="button" contenteditable="false" class="drawing-action primary" data-drawing-action="done">' + ICONS.check + '</button>' +
        '</div>' +
        '</div>';
    }

    function getDrawingSnapshot(card) {
      const image = card.querySelector('.drawing-image[src], .drawing-image[data-drawing-src], img[src]');
      const imageSrc = image ? (image.getAttribute('src') || image.dataset.drawingSrc || '') : '';
      if (imageSrc) return imageSrc;

      const svg = Array.from(card.querySelectorAll('svg')).find(s => !s.closest('.drawing-toolbar'));
      if (!svg) return '';

      const clone = svg.cloneNode(true);
      if (!clone.getAttribute('xmlns')) {
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      }
      const serialized = new XMLSerializer().serializeToString(clone);
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(serialized);
    }

    function normalizeDrawingCards() {
      Array.from(editor.querySelectorAll('.drawing-card')).forEach(function(card) {
        card.setAttribute('contenteditable', 'false');
        card.dataset.mediaType = 'drawing';

        const snapshot = getDrawingSnapshot(card);

        if (!card.querySelector('.drawing-toolbar')) {
          card.insertAdjacentHTML('afterbegin', getDrawingToolbarHtml());
        }

        let surface = card.querySelector('.drawing-surface');
        if (!surface) {
          surface = document.createElement('div');
          surface.className = 'drawing-surface';
          const toolbar = card.querySelector('.drawing-toolbar');
          card.insertBefore(surface, toolbar ? toolbar.nextSibling : card.firstChild);
        }

        let canvas = card.querySelector('.drawing-canvas');
        if (!canvas) {
          canvas = document.createElement('canvas');
          canvas.className = 'drawing-canvas';
          canvas.width = 1200;
          canvas.height = 900;
          surface.appendChild(canvas);
        } else if (canvas.parentElement !== surface) {
          surface.appendChild(canvas);
        }
        canvas.removeAttribute('data-ready');

        let image = card.querySelector('.drawing-image');
        if (!image) {
          image = document.createElement('img');
          image.className = 'drawing-image';
          image.alt = 'Çizim';
          card.appendChild(image);
        }

        if (snapshot) {
          image.setAttribute('src', snapshot);
          image.dataset.drawingSrc = snapshot;
          card.dataset.hasDrawing = 'true';
        }

        Array.from(card.children).forEach(function(child) {
          if (child.tagName && child.tagName.toLowerCase() === 'svg') {
            child.remove();
          }
        });
      });
    }

    function canvasToDrawingPngDataUrl(canvas) {
      try {
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = canvas.width || 1200;
        exportCanvas.height = canvas.height || 900;
        const exportContext = exportCanvas.getContext('2d');
        if (!exportContext) return canvas.toDataURL('image/png');
        exportContext.fillStyle = '#000000';
        exportContext.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        exportContext.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height);
        return exportCanvas.toDataURL('image/png');
      } catch (error) {}

      try {
        return canvas.toDataURL('image/png');
      } catch (error) {
        return '';
      }
    }

    function completeDrawingCard(card) {
      if (!card) return false;
      card.dataset.lastDrawingDoneAt = String(Date.now());
      if (card.__finishDrawing) {
        card.__finishDrawing();
        return true;
      }

      const canvas = card.querySelector('.drawing-canvas');
      const image = card.querySelector('.drawing-image');
      if (canvas && image) {
        try {
          const dataUrl = canvasToDrawingPngDataUrl(canvas);
          if (dataUrl) {
            image.src = dataUrl;
            image.dataset.drawingSrc = dataUrl;
            card.dataset.hasDrawing = 'true';
          }
        } catch (error) {}
      }

      const toolbar = card.querySelector('.drawing-toolbar');
      if (toolbar) toolbar.style.display = 'none';
      const surface = card.querySelector('.drawing-surface');
      if (surface) surface.style.display = 'none';
      if (canvas) canvas.style.display = 'none';
      if (image) image.style.display = 'block';
      card.style.background = 'transparent';
      card.style.padding = '0';
      notifyChange();
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'haptic', style: 'success' }));
      placeCaretInNode(ensureParagraphAfter(card));
      return true;
    }

    function handleDrawingDoneCapture(event) {
      const doneButton = closestFrom(event.target, '[data-drawing-action="done"]');
      if (!doneButton) return;
      const card = closestFrom(doneButton, '.drawing-card');
      if (!card) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();

      const now = Date.now();
      const lastDoneAt = Number(card.dataset.lastDrawingDoneAt || 0);
      if (now - lastDoneAt < 350) return;
      card.dataset.lastDrawingDoneAt = String(now);
      completeDrawingCard(card);
    }

    document.addEventListener('pointerdown', handleDrawingDoneCapture, true);
    document.addEventListener('touchstart', handleDrawingDoneCapture, true);
    document.addEventListener('mousedown', handleDrawingDoneCapture, true);
    document.addEventListener('click', handleDrawingDoneCapture, true);

    function initDrawing(card) {
      const canvas = card.querySelector('.drawing-canvas');
      if (!canvas || canvas.__drawingReady === true) return;
      canvas.removeAttribute('data-ready');
      const context = canvas.getContext('2d');
      if (!context) return;
      canvas.__drawingReady = true;
      const image = card.querySelector('.drawing-image');
      let drawing = false;
      let activeColor = '#FFFFFF';
      let lastPoint = null;
      const history = [];
      let snapshotReady = false;
      let pendingSnapshot = '';
      let lastTouchAt = 0;
      let lastControlAt = 0;
      let lastDrawStartAt = 0;
      let activePointerId = null;

      function clearCanvas() {
        context.clearRect(0, 0, canvas.width, canvas.height);
      }

      function setCanvasFallback(dataUrl) {
        if (!dataUrl) return;
        canvas.style.backgroundImage = 'url("' + dataUrl.replace(/"/g, '\\"') + '")';
        canvas.style.backgroundRepeat = 'no-repeat';
        canvas.style.backgroundPosition = 'center';
        canvas.style.backgroundSize = 'contain';
      }

      function clearCanvasFallback() {
        canvas.style.backgroundImage = '';
        canvas.style.backgroundRepeat = '';
        canvas.style.backgroundPosition = '';
        canvas.style.backgroundSize = '';
      }

      function captureCanvasDataUrl() {
        try {
          return canvasToDrawingPngDataUrl(canvas);
        } catch (error) {
          return image ? (image.getAttribute('src') || image.dataset.drawingSrc || pendingSnapshot || '') : pendingSnapshot;
        }
      }

      function pushHistory() {
        history.push(snapshotReady ? captureCanvasDataUrl() : (pendingSnapshot || captureCanvasDataUrl()));
        if (history.length > 24) {
          history.shift();
        }
      }

      function restoreFromDataUrl(dataUrl) {
        if (!dataUrl) return;
        pendingSnapshot = dataUrl;
        setCanvasFallback(dataUrl);
        const restoreImage = new Image();
        restoreImage.onload = function() {
          clearCanvas();
          drawSnapshotImage(restoreImage);
          snapshotReady = true;
          clearCanvasFallback();
          persistDrawing();
        };
        restoreImage.src = dataUrl;
      }

      function drawSnapshotImage(sourceImage) {
        const sourceWidth = sourceImage.naturalWidth || sourceImage.width || canvas.width;
        const sourceHeight = sourceImage.naturalHeight || sourceImage.height || canvas.height;
        const scale = Math.min(canvas.width / sourceWidth, canvas.height / sourceHeight);
        const drawWidth = sourceWidth * scale;
        const drawHeight = sourceHeight * scale;
        const left = (canvas.width - drawWidth) / 2;
        const top = (canvas.height - drawHeight) / 2;
        context.drawImage(sourceImage, left, top, drawWidth, drawHeight);
      }

      function getPoint(event) {
        const source = event.touches?.[0] || event.changedTouches?.[0] || event;
        const rect = canvas.getBoundingClientRect();
        return {
          x: ((source.clientX - rect.left) / rect.width) * canvas.width,
          y: ((source.clientY - rect.top) / rect.height) * canvas.height,
        };
      }

      function persistDrawing() {
        if (image) {
          const dataUrl = snapshotReady ? captureCanvasDataUrl() : (pendingSnapshot || captureCanvasDataUrl());
          if (!dataUrl) return;
          image.src = dataUrl;
          image.dataset.drawingSrc = dataUrl;
          card.dataset.hasDrawing = 'true';
        }
        notifyChange();
      }

      function finishDrawing() {
        card.dataset.lastDrawingDoneAt = String(Date.now());
        drawing = false;
        lastPoint = null;
        if (activePointerId !== null) {
          try {
            canvas.releasePointerCapture?.(activePointerId);
          } catch (error) {}
          activePointerId = null;
        }
        persistDrawing();
        const tb = card.querySelector('.drawing-toolbar');
        if (tb) tb.style.display = 'none';
        const surface = card.querySelector('.drawing-surface');
        if (surface) surface.style.display = 'none';
        const canvasEl = card.querySelector('.drawing-canvas');
        if (canvasEl) canvasEl.style.display = 'none';
        const img = card.querySelector('.drawing-image');
        if (img) img.style.display = 'block';
        card.style.background = 'transparent';
        card.style.padding = '0';
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'haptic', style: 'success' }));
        placeCaretInNode(ensureParagraphAfter(card));
      }

      card.__finishDrawing = finishDrawing;

      function drawTo(point) {
        if (!lastPoint) {
          lastPoint = point;
        }

        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.strokeStyle = activeColor;
        context.lineWidth = 7;
        context.beginPath();
        context.moveTo(lastPoint.x, lastPoint.y);
        context.lineTo(point.x, point.y);
        context.stroke();
        lastPoint = point;
      }

      const existingDrawingSrc = image ? (image.getAttribute('src') || image.dataset.drawingSrc || '') : '';
      if (image && existingDrawingSrc) {
        pendingSnapshot = existingDrawingSrc;
        setCanvasFallback(existingDrawingSrc);
        image.dataset.drawingSrc = existingDrawingSrc;
        card.dataset.hasDrawing = 'true';
        const loadedImage = new Image();
        loadedImage.onload = function() {
          clearCanvas();
          drawSnapshotImage(loadedImage);
          snapshotReady = true;
          clearCanvasFallback();
        };
        loadedImage.onerror = function() {
          snapshotReady = false;
        };
        loadedImage.src = existingDrawingSrc;
      }

      function shouldIgnoreSyntheticMouse(event) {
        return event.type.indexOf('mouse') === 0 && Date.now() - lastTouchAt < 650;
      }

      function beginDrawing(event) {
        if (shouldIgnoreSyntheticMouse(event)) return;
        if (drawing && Date.now() - lastDrawStartAt < 120) return;
        if (event.type.indexOf('touch') === 0) {
          lastTouchAt = Date.now();
        }
        event.preventDefault();
        event.stopPropagation();
        if (event.pointerId !== undefined) {
          activePointerId = event.pointerId;
          try {
            canvas.setPointerCapture?.(event.pointerId);
          } catch (error) {}
        }
        pushHistory();
        drawing = true;
        snapshotReady = true;
        clearCanvasFallback();
        lastDrawStartAt = Date.now();
        lastPoint = getPoint(event);
        drawTo(lastPoint);
      }

      function moveDrawing(event) {
        if (!drawing) return;
        if (shouldIgnoreSyntheticMouse(event)) return;
        if (event.type.indexOf('touch') === 0) {
          lastTouchAt = Date.now();
        }
        event.preventDefault();
        event.stopPropagation();
        drawTo(getPoint(event));
      }

      function endDrawing(event) {
        if (!drawing) return;
        if (shouldIgnoreSyntheticMouse(event)) return;
        if (event.type.indexOf('touch') === 0) {
          lastTouchAt = Date.now();
        }
        event.preventDefault();
        event.stopPropagation();
        drawing = false;
        lastPoint = null;
        if (event.pointerId !== undefined) {
          try {
            canvas.releasePointerCapture?.(event.pointerId);
          } catch (error) {}
          activePointerId = null;
        }
        persistDrawing();
      }

      canvas.addEventListener('pointerdown', beginDrawing, { passive: false });
      canvas.addEventListener('pointermove', moveDrawing, { passive: false });
      canvas.addEventListener('pointerup', endDrawing, { passive: false });
      canvas.addEventListener('pointercancel', endDrawing, { passive: false });
      canvas.addEventListener('pointerleave', endDrawing, { passive: false });
      canvas.addEventListener('touchstart', beginDrawing, { passive: false });
      canvas.addEventListener('touchmove', moveDrawing, { passive: false });
      canvas.addEventListener('touchend', endDrawing, { passive: false });
      canvas.addEventListener('touchcancel', endDrawing, { passive: false });
      canvas.addEventListener('mousedown', beginDrawing, { passive: false });
      canvas.addEventListener('mousemove', moveDrawing, { passive: false });
      canvas.addEventListener('mouseup', endDrawing, { passive: false });
      canvas.addEventListener('mouseleave', endDrawing, { passive: false });

      function handleDrawingControl(event) {
        if (Date.now() - lastControlAt < 120) return false;
        if (event.type === 'click' && Date.now() - lastControlAt < 350) return false;
        const colorButton = closestFrom(event.target, '[data-drawing-color]');
        if (colorButton) {
          event.preventDefault();
          event.stopPropagation();
          lastControlAt = Date.now();
          activeColor = colorButton.dataset.drawingColor || activeColor;
          card.querySelectorAll('.drawing-color').forEach(function(button) {
            button.classList.toggle('is-active', button === colorButton);
          });
          return true;
        }

        const actionButton = closestFrom(event.target, '[data-drawing-action]');
        if (!actionButton) return false;
        event.preventDefault();
        event.stopPropagation();
        lastControlAt = Date.now();

        if (actionButton.dataset.drawingAction === 'clear') {
          pushHistory();
          clearCanvas();
          if (image) {
            image.removeAttribute('src');
            delete image.dataset.drawingSrc;
            delete card.dataset.hasDrawing;
          }
          pendingSnapshot = '';
          snapshotReady = true;
          clearCanvasFallback();
          notifyChange();
        }

        if (actionButton.dataset.drawingAction === 'undo') {
          const previous = history.pop();
          if (previous) {
            restoreFromDataUrl(previous);
          }
        }

        if (actionButton.dataset.drawingAction === 'delete') {
          removeAtomicBlock(card);
        }

        if (actionButton.dataset.drawingAction === 'done') {
          finishDrawing();
        }

        return true;
      }

      function handleDrawingClick(event) {
        const lastDoneAt = Number(card.dataset.lastDrawingDoneAt || 0);
        if (lastDoneAt && Date.now() - lastDoneAt < 900) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        if (handleDrawingControl(event)) return;
        if (!closestFrom(event.target, '.drawing-toolbar')) {
          const tb = card.querySelector('.drawing-toolbar');
          if (tb && tb.style.display === 'none') {
            tb.style.display = '';
            const surface = card.querySelector('.drawing-surface');
            if (surface) surface.style.display = '';
            const canvas = card.querySelector('.drawing-canvas');
            if (canvas) canvas.style.display = '';
            const img = card.querySelector('.drawing-image');
            if (img) img.style.display = 'none';
            card.style.background = 'rgba(17,17,19,0.95)';
            card.style.padding = '10px';
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'haptic', style: 'selection' }));
          }
        }
      }

      card.addEventListener('pointerup', handleDrawingControl, { passive: false });
      card.addEventListener('touchend', handleDrawingControl, { passive: false });
      card.addEventListener('click', handleDrawingClick);

      const toolbar = card.querySelector('.drawing-toolbar');
      if (toolbar && toolbar.__drawingControlsReady !== true) {
        toolbar.__drawingControlsReady = true;
        toolbar.addEventListener('pointerdown', handleDrawingControl, { passive: false });
        toolbar.addEventListener('touchstart', handleDrawingControl, { passive: false });
        toolbar.addEventListener('mousedown', handleDrawingControl, { passive: false });
        toolbar.addEventListener('click', handleDrawingControl, { passive: false });
      }
    }

    function hydrateDrawings() {
      normalizeDrawingCards();
      Array.from(editor.querySelectorAll('.drawing-card')).forEach(initDrawing);
    }

    function getVideoSourceForPreview(uri) {
      if (!uri) return '';
      if (/^(file|content|data|blob):/i.test(uri)) {
        return uri;
      }
      return uri.indexOf('#t=') > -1 ? uri : uri + '#t=0.1';
    }

    function getPdfPreviewSource(uri) {
      if (!uri) return '';
      if (/^(file|content|data|blob):/i.test(uri)) {
        return uri;
      }
      const isAndroid = navigator.userAgent.toLowerCase().includes('android');
      return isAndroid ? 'https://docs.google.com/gview?embedded=true&url=' + encodeURIComponent(uri) : uri;
    }

    function insertMediaFromPayload(payload) {
      const item = typeof payload === 'string' ? JSON.parse(payload) : payload;
      const name = escapeHtml(item.fileName || (item.type === 'video' ? 'Video' : 'Görsel'));
      const uri = escapeAttr(item.uri);
      const localId = item.localId ? ' data-local-id="' + escapeAttr(item.localId) + '"' : '';
      const uploadClass = item.isUploading ? ' is-uploading' : '';
      const previewUri = item.keepLocalPreview && (item.type === 'image' || item.type === 'video')
        ? ' data-preview-uri="' + uri + '"'
        : '';
      const mediaWidth = Number(item.width || 0);
      const mediaHeight = Number(item.height || 0);
      const dimensions = mediaWidth > 0 && mediaHeight > 0
        ? ' width="' + Math.round(mediaWidth) + '" height="' + Math.round(mediaHeight) + '"'
        : '';
      const metadata = ' data-sha256="' + escapeAttr(item.sha256 || '') + '"' +
        ' data-metadata-event="' + escapeAttr(item.metadataEventId || '') + '"' +
        ' data-blossom-server="' + escapeAttr(item.server || '') + '"';

      if (item.type === 'video') {
        const videoSrc = escapeAttr(getVideoSourceForPreview(item.uri));
        insertAtomicBlockAtSelection(
          '<figure class="media-card' + uploadClass + '" contenteditable="false" data-media-type="video"' + metadata + localId + previewUri + '>' +
          '<button type="button" contenteditable="false" class="block-remove-button" data-remove-block="true"></button>' +
          '<div class="media-frame"><video src="' + videoSrc + '" controls playsinline preload="auto"' + dimensions + '></video></div>' +
          '</figure>'
        );
        return;
      }

      if (item.type === 'pdf') {
        const pdfTitleText = item.name || item.fileName || 'PDF';
        const rawPdfUrl = escapeAttr(item.uri);
        const pdfSrc = escapeAttr(getPdfPreviewSource(item.uri));
        insertAtomicBlockAtSelection(
          '<figure class="media-card pdf-viewer-card' + uploadClass + '" contenteditable="false" data-media-type="pdf"' + metadata + localId + ' data-raw-url="' + rawPdfUrl + '" data-pdf-title="' + escapeAttr(pdfTitleText) + '">' +
          '<div class="pdf-card-header">' +
          '<span class="pdf-title">' + escapeHtml(pdfTitleText) + '</span>' +
          '<button type="button" contenteditable="false" class="file-menu-button" data-file-menu="true" aria-label="Options"></button>' +
          '<button type="button" contenteditable="false" class="block-remove-button" data-remove-block="true" aria-label="Kaldır"></button>' +
          '</div>' +
          '<div class="pdf-preview-shell">' +
          '<div class="pdf-click-overlay" data-raw-url="' + rawPdfUrl + '"></div>' +
          '<iframe src="' + pdfSrc + '" frameborder="0" scrolling="no" allowfullscreen></iframe>' +
          '</div>' +
          '</figure>'
        );
        return;
      }

      insertAtomicBlockAtSelection(
        '<figure class="media-card' + uploadClass + '" contenteditable="false" data-media-type="image"' + metadata + localId + previewUri + '>' +
        '<button type="button" contenteditable="false" class="block-remove-button" data-remove-block="true"></button>' +
        '<div class="media-frame"><img src="' + uri + '" alt="' + name + '"' + dimensions + ' /></div>' +
        '</figure>'
      );
    }

    function insertFileFromPayload(payload) {
      const item = typeof payload === 'string' ? JSON.parse(payload) : payload;
      const name = escapeHtml(item.name || item.fileName || 'Dosya');
      const uri = escapeAttr(item.uri);
      const localId = item.localId ? ' data-local-id="' + escapeAttr(item.localId) + '"' : '';
      const meta = [escapeHtml(item.mimeType || 'Dosya'), formatBytes(item.size || item.fileSize)]
        .filter(Boolean)
        .join(' • ');
      const metadata = ' data-sha256="' + escapeAttr(item.sha256 || '') + '"' +
        ' data-metadata-event="' + escapeAttr(item.metadataEventId || '') + '"' +
        ' data-blossom-server="' + escapeAttr(item.server || '') + '"';

      insertAtomicBlockAtSelection(
        '<a class="file-card" href="' + uri + '" contenteditable="false" data-media-type="file"' + metadata + localId + '>' +
        '<button type="button" contenteditable="false" class="file-menu-button" data-file-menu="true" aria-label="Options"></button>' +
        '<button type="button" contenteditable="false" class="block-remove-button" data-remove-block="true"></button>' +
        '<div class="file-icon-placeholder"></div>' +
        '<div class="file-title">' + name + '</div>' +
        '<div class="file-meta">' + meta + '</div>' +
        '</a>'
      );
    }

    // Debounced content change notification
    let changeTimeout;
    let suppressControlSelection = false;

    function serializeEditorContent() {
      const clone = editor.cloneNode(true);
      Array.from(clone.querySelectorAll('.math-inline.is-selected, .math-display.is-selected')).forEach(function(atom) {
        atom.classList.remove('is-selected');
      });
      Array.from(clone.querySelectorAll('.media-card[data-remote-url]')).forEach(function(card) {
        const remoteUrl = card.getAttribute('data-remote-url');
        if (!remoteUrl) return;
        const media = card.querySelector('img, video');
        if (media) {
          const mediaType = card.getAttribute('data-media-type');
          media.setAttribute('src', mediaType === 'video' ? remoteUrl + '#t=0.1' : remoteUrl);
        }
        card.classList.remove('is-uploading');
        card.removeAttribute('data-local-id');
        card.removeAttribute('data-preview-uri');
        card.removeAttribute('data-remote-url');
      });
      return clone.innerHTML;
    }

    function notifyChange() {
      clearTimeout(changeTimeout);
      changeTimeout = setTimeout(() => {
        const html = serializeEditorContent();
        if (html !== lastContent) {
          lastContent = html;
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'contentChange',
            content: html
          }));
        }
      }, 100);
    }

    function getCaretRect(targetElement) {
      if (targetElement && targetElement.getBoundingClientRect) {
        const targetRect = targetElement.getBoundingClientRect();
        if (targetRect && (targetRect.height > 0 || targetRect.width > 0)) {
          return targetRect;
        }
      }

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return null;
      const range = sel.getRangeAt(0);
      let rect = range.getClientRects && range.getClientRects().length
        ? range.getClientRects()[0]
        : range.getBoundingClientRect();

      if ((!rect || (rect.height === 0 && rect.width === 0)) && sel.focusNode) {
        const focusBlock = closestFrom(sel.focusNode, 'p, li, h1, h2, blockquote, pre, td, th');
        if (focusBlock) {
          rect = focusBlock.getBoundingClientRect();
        }
      }

      if (!rect || (rect.height === 0 && rect.width === 0)) {
        const editorRect = editor.getBoundingClientRect();
        if (editorRect && (editorRect.height > 0 || editorRect.width > 0)) {
          const caretHeight = Math.min(Math.max(parseFloat(getComputedStyle(editor).lineHeight) || 28, 1), 32);
          rect = {
            top: editorRect.top,
            bottom: editorRect.top + caretHeight,
            left: editorRect.left,
            right: editorRect.left + 1,
            width: 1,
            height: caretHeight
          };
        }
      }

      return rect;
    }

    function scrollToCaret(options) {
      options = options || {};
      const scrollRoot = document.scrollingElement || document.documentElement;
      if (isEditorEmpty() && !options.target) {
        if (scrollRoot.scrollTop !== 0) {
          scrollRoot.scrollTop = 0;
        }
        return;
      }

      const rect = getCaretRect(options.target || activeCaretElement);
      if (!rect) return;

      const viewport = window.visualViewport;
      const viewportHeight = viewport ? viewport.height : window.innerHeight;
      const viewportTop = viewport ? viewport.offsetTop : 0;
      const topPadding = options.afterKeyboard ? 28 : 24;
      const bottomPadding = options.afterKeyboard ? 112 : 72;
      const visibleTop = viewportTop + topPadding;
      const visibleBottom = viewportTop + viewportHeight - bottomPadding;
      const visibleHeight = Math.max(visibleBottom - visibleTop, 120);
      const comfortableTop = visibleTop + 12;
      const comfortableBottom = visibleBottom - 20;
      const preferredY = visibleTop + visibleHeight * (options.pin ? 0.6 : 0.54);
      const caretAnchor = Math.min(rect.bottom || rect.top, rect.top + 32);

      let nextTop = scrollRoot.scrollTop;
      if (options.pin) {
        nextTop += caretAnchor - preferredY;
      } else if (rect.bottom > comfortableBottom) {
        nextTop += rect.bottom - comfortableBottom;
      } else if (rect.top < comfortableTop) {
        nextTop += rect.top - comfortableTop;
      }

      const maxTop = Math.max(scrollRoot.scrollHeight - viewportHeight, 0);
      nextTop = Math.max(0, Math.min(nextTop, maxTop));
      if (Math.abs(nextTop - scrollRoot.scrollTop) > 1) {
        if (options.smooth) {
          window.scrollTo({ top: nextTop, behavior: 'smooth' });
        } else {
          scrollRoot.scrollTop = nextTop;
        }
      }
    }

    function focusContinuation(paragraph) {
      if (!paragraph) return;
      lastContinuationFocusAt = Date.now();
      activeCaretElement = paragraph;
      placeCaretInNode(paragraph);
      revealCaretAfterKeyboard(paragraph);
    }

    function focusCaretViewport() {
      activeCaretElement = null;
      revealCaretAfterKeyboard();
    }

    function updateScrollShadows() {
      const scrollRoot = document.scrollingElement || document.documentElement;
      if (!editorScrollIndicator) return;
      const viewportHeight = Math.max(window.innerHeight, 1);
      const contentHeight = Math.max(scrollRoot.scrollHeight, viewportHeight);
      const maxScroll = Math.max(contentHeight - viewportHeight, 0);
      if (maxScroll <= 2) {
        editorScrollIndicator.style.opacity = '0';
        return;
      }
      const trackHeight = Math.max(viewportHeight - 8, 1);
      const thumbHeight = Math.max(30, Math.round((viewportHeight / contentHeight) * trackHeight));
      const maxTravel = Math.max(trackHeight - thumbHeight, 0);
      const thumbTop = Math.round((scrollRoot.scrollTop / maxScroll) * maxTravel);
      editorScrollIndicator.style.height = thumbHeight + 'px';
      editorScrollIndicator.style.transform = 'translateY(' + thumbTop + 'px)';
      editorScrollIndicator.style.opacity = '0.56';
    }

    function isEditorEmpty() {
      return editor.innerText.replace(/\u200b/g, '').trim() === '' &&
        !editor.querySelector(ATOMIC_BLOCK_SELECTOR);
    }

    function stabilizeCaretAfterKeyboard(options) {
      options = options || {};
      if (isEditorEmpty()) {
        const scrollRoot = document.scrollingElement || document.documentElement;
        if (scrollRoot.scrollTop > 0) {
          window.scrollTo({ top: 0, behavior: 'auto' });
        }
      }

      requestAnimationFrame(function() {
        scrollToCaret(options);
      });
      clearTimeout(caretTimerShort);
      clearTimeout(caretTimerLong);
      clearTimeout(caretTimerFinal);
      caretTimerShort = setTimeout(function() {
        scrollToCaret(options);
      }, 80);
      caretTimerLong = setTimeout(function() {
        scrollToCaret(options);
      }, 220);
      caretTimerFinal = setTimeout(function() {
        scrollToCaret(options);
      }, 520);
    }

    function revealCaretAfterKeyboard(target) {
      const shouldPin = Boolean(target) || Date.now() - lastContinuationFocusAt < 900;
      const options = { afterKeyboard: true, pin: shouldPin, target: target || activeCaretElement };
      clearTimeout(caretTimerShort);
      clearTimeout(caretTimerLong);
      clearTimeout(caretTimerFinal);
      requestAnimationFrame(function() {
        scrollToCaret(options);
      });
      caretTimerShort = setTimeout(function() {
        scrollToCaret(options);
      }, 140);
      caretTimerLong = setTimeout(function() {
        scrollToCaret(options);
      }, 360);
      caretTimerFinal = setTimeout(function() {
        scrollToCaret(options);
      }, 640);
    }

    function closestFrom(target, selector) {
      if (!target) return null;
      const element = target.nodeType === 1 ? target : target.parentElement;
      return element && element.closest ? element.closest(selector) : null;
    }

    function isEditorControlTarget(target) {
      return Boolean(closestFrom(target,
        '.note-table-controls, .note-table-column-handles, .note-table-row-handles, .note-table-popover, .drawing-toolbar, .block-remove-button, .file-menu-button'
      ));
    }

    function suppressControlCaret() {
      suppressControlSelection = true;
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
      }
      if (document.activeElement && isEditorControlTarget(document.activeElement)) {
        document.activeElement.blur();
      }
      setTimeout(function() {
        suppressControlSelection = false;
      }, 180);
    }

    const DEFAULT_CARET_COLOR = '#FFFFFF';

    function normalizeCaretColor(value) {
      if (!value) return DEFAULT_CARET_COLOR;
      const color = String(value).trim();
      if (!color || color === 'inherit' || color === 'initial' || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
        return DEFAULT_CARET_COLOR;
      }
      return color;
    }

    function getSelectionTextColor() {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return DEFAULT_CARET_COLOR;
      }

      if (selection.isCollapsed && pendingColor) {
        return normalizeCaretColor(pendingColor);
      }

      if (selectedMathAtom && editor.contains(selectedMathAtom)) {
        return normalizeCaretColor(window.getComputedStyle(selectedMathAtom).color);
      }

      let node = selection.focusNode || selection.anchorNode;
      if (!node) {
        return DEFAULT_CARET_COLOR;
      }

      let element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
      if (!element || !editor.contains(element)) {
        return DEFAULT_CARET_COLOR;
      }

      if (element === editor) {
        const range = selection.getRangeAt(0);
        element = range.startContainer.nodeType === Node.ELEMENT_NODE
          ? range.startContainer
          : range.startContainer.parentElement;
      }

      if (!element || !editor.contains(element) || element === editor) {
        return DEFAULT_CARET_COLOR;
      }

      return normalizeCaretColor(window.getComputedStyle(element).color);
    }

    function updateCaretColor(color) {
      const nextColor = normalizeCaretColor(color || getSelectionTextColor());
      document.documentElement.style.setProperty('--editor-caret-color', nextColor);
      editor.style.setProperty('caret-color', nextColor, 'important');
      const activeCell = closestFrom(window.getSelection()?.focusNode, 'td, th');
      if (activeCell) activeCell.style.setProperty('caret-color', nextColor, 'important');
    }

    // Track active styles
    function getActiveStyles() {
      const styles = [];
      if (selectedMathAtom && editor.contains(selectedMathAtom)) {
        if (getMathFormatState(selectedMathAtom, 'bold')) styles.push('bold');
        if (getMathFormatState(selectedMathAtom, 'italic')) styles.push('italic');
        if (getMathFormatState(selectedMathAtom, 'underline')) styles.push('underline');
        if (getMathFormatState(selectedMathAtom, 'strike')) styles.push('strikethrough');
      } else {
        if (document.queryCommandState('bold')) styles.push('bold');
        if (document.queryCommandState('italic')) styles.push('italic');
        if (document.queryCommandState('underline')) styles.push('underline');
        if (document.queryCommandState('strikeThrough')) styles.push('strikethrough');
      }
      if (document.queryCommandState('insertUnorderedList')) styles.push('bulletList');
      if (document.queryCommandState('insertOrderedList')) styles.push('orderedList');

      // Check heading
      const block = document.queryCommandValue('formatBlock');
      if (block === 'h1') styles.push('heading1');
      if (block === 'h2') styles.push('heading2');
      if (block === 'p' || block === '') styles.push('paragraph');

      const textColor = getSelectionTextColor();
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'activeStyles',
        styles: styles,
        textColor: textColor
      }));
      updateCaretColor(textColor);
    }

    function applyColorToRange(color) {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return false;

      const range = selection.getRangeAt(0);
      if (range.collapsed || !editor.contains(range.commonAncestorContainer)) return false;

      const root = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentNode
        : range.commonAncestorContainer;
      const textNodes = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function(node) {
          if (!node.nodeValue || !node.nodeValue.length) return NodeFilter.FILTER_REJECT;
          const editableHost = node.parentElement && node.parentElement.closest('[contenteditable]');
          if (!editableHost || editableHost.getAttribute('contenteditable') !== 'true') {
            return NodeFilter.FILTER_REJECT;
          }
          try {
            return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
          } catch (error) {
            return NodeFilter.FILTER_REJECT;
          }
        }
      });

      if (range.commonAncestorContainer.nodeType === Node.TEXT_NODE) {
        textNodes.push(range.commonAncestorContainer);
      } else {
        let currentNode = walker.nextNode();
        while (currentNode) {
          textNodes.push(currentNode);
          currentNode = walker.nextNode();
        }
      }

      const segments = textNodes.map(function(node) {
        const start = node === range.startContainer ? range.startOffset : 0;
        const end = node === range.endContainer ? range.endOffset : node.nodeValue.length;
        return { node: node, start: start, end: end };
      }).filter(function(segment) {
        return segment.end > segment.start;
      });

      if (!segments.length) return false;

      const styledTextNodes = new Array(segments.length);
      for (let index = segments.length - 1; index >= 0; index -= 1) {
        const segment = segments[index];
        let selectedNode = segment.node;
        if (segment.end < selectedNode.nodeValue.length) {
          selectedNode.splitText(segment.end);
        }
        if (segment.start > 0) {
          selectedNode = selectedNode.splitText(segment.start);
        }

        const colorSpan = document.createElement('span');
        colorSpan.style.color = color;
        selectedNode.parentNode.insertBefore(colorSpan, selectedNode);
        colorSpan.appendChild(selectedNode);
        styledTextNodes[index] = selectedNode;
      }

      const nextRange = document.createRange();
      const firstNode = styledTextNodes[0];
      const lastNode = styledTextNodes[styledTextNodes.length - 1];
      nextRange.setStart(firstNode, 0);
      nextRange.setEnd(lastNode, lastNode.nodeValue.length);
      selection.removeAllRanges();
      selection.addRange(nextRange);
      savedRange = nextRange.cloneRange();
      return true;
    }

    editor.addEventListener('input', () => {
      activeCaretElement = null;
      clearSelectedMathAtom();
      updateCaretColor();
      requestAnimationFrame(scrollToCaret);
      saveSelection();
      notifyChange();
      requestAnimationFrame(syncAllTables);
      requestAnimationFrame(normalizeAtomicContinuations);
      requestAnimationFrame(updateScrollShadows);
    });
    editor.addEventListener('keyup', () => {
      activeCaretElement = null;
      requestAnimationFrame(scrollToCaret);
      saveSelection();
      getActiveStyles();
    });
    editor.addEventListener('keydown', (event) => {
      if (selectedMathAtom && (event.key === 'Backspace' || event.key === 'Delete')) {
        event.preventDefault();
        removeSelectedMathAtom();
        return;
      }
      if (selectedMathAtom && event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        clearSelectedMathAtom();
      }
    });
    editor.addEventListener('beforeinput', (event) => {
      if (
        selectedMathAtom &&
        (event.inputType === 'deleteContentBackward' || event.inputType === 'deleteContentForward')
      ) {
        event.preventDefault();
        removeSelectedMathAtom();
      }
    });
    editor.addEventListener('click', () => {
      updateCaretColor();
      requestAnimationFrame(scrollToCaret);
    });

    window.addEventListener('resize', function() {
      stabilizeCaretAfterKeyboard({
        afterKeyboard: true,
        pin: Date.now() - lastContinuationFocusAt < 900,
        target: activeCaretElement
      });
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', function() {
        stabilizeCaretAfterKeyboard({
          afterKeyboard: true,
          pin: Date.now() - lastContinuationFocusAt < 900,
          target: activeCaretElement
        });
      });
    }

    editor.addEventListener('mousedown', (event) => {
      if (isEditorControlTarget(event.target)) {
        suppressControlCaret();
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
    editor.addEventListener('pointerdown', (event) => {
      if (isEditorControlTarget(event.target)) {
        suppressControlCaret();
      }
    }, true);
    editor.addEventListener('touchstart', (event) => {
      if (isEditorControlTarget(event.target)) {
        suppressControlCaret();
      }
    }, true);
    editor.addEventListener('mouseup', (event) => {
      if (isEditorControlTarget(event.target)) return;
      saveSelection();
      focusCaretViewport();
      getActiveStyles();
    });
    editor.addEventListener('touchend', (event) => {
      if (isEditorControlTarget(event.target)) return;
      const continuation = closestFrom(event.target, 'p.composer-continuation');
      if (continuation) {
        event.preventDefault();
        focusContinuation(continuation);
        getActiveStyles();
        return;
      }
      setTimeout(() => {
        saveSelection();
        focusCaretViewport();
        getActiveStyles();
      }, 0);
    });
    document.addEventListener('selectionchange', () => {
      if (suppressControlSelection) return;
      saveSelection();
      getActiveStyles();
    });
    window.addEventListener('scroll', updateScrollShadows, { passive: true });
    window.addEventListener('resize', () => {
      requestAnimationFrame(syncAllTables);
      requestAnimationFrame(updateScrollShadows);
    });

    editor.addEventListener('click', function(e) {
      var mathAtom = closestFrom(e.target, '.math-inline, .math-display');
      if (mathAtom) {
        e.preventDefault();
        e.stopPropagation();
        if (selectedMathAtom === mathAtom && openMathAtomEditor(mathAtom)) {
          return;
        }
        selectMathAtom(mathAtom);
        return;
      }

      var removeButton = closestFrom(e.target, '[data-remove-block]');
      if (removeButton) {
        e.preventDefault();
        e.stopPropagation();
        var block = removeButton.closest('.media-card, .file-card, .drawing-card, .note-table-shell');
        if (block) {
          var localId = block.getAttribute('data-local-id') || '';
          var mediaType = block.getAttribute('data-media-type') || '';
          removeAtomicBlock(block);
          if (localId && window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'cancelUpload', id: localId, mediaType: mediaType }));
          }
        }
        return;
      }

      var fileMenu = closestFrom(e.target, '[data-file-menu]');
      if (fileMenu && window.ReactNativeWebView) {
        e.preventDefault();
        e.stopPropagation();
        var menuBlock = fileMenu.closest('.media-card, .file-card');
        if (menuBlock) {
          var menuTitleEl = menuBlock.querySelector('.pdf-title, .file-title');
          var menuTitle = menuBlock.getAttribute('data-pdf-title') || (menuTitleEl ? menuTitleEl.innerText : '') || 'Dosya';
          var menuType = menuBlock.getAttribute('data-media-type') || 'file';
          var menuUrl = menuBlock.getAttribute('data-raw-url') || menuBlock.getAttribute('href') || '';
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'fileMenu',
            mediaType: menuType,
            url: menuUrl,
            title: menuTitle,
            isPdf: menuType === 'pdf' || String(menuUrl).toLowerCase().includes('.pdf')
          }));
        }
        return;
      }

      var link = closestFrom(e.target, 'a');
      if (link && !link.classList.contains('file-card') && window.ReactNativeWebView) {
        e.preventDefault();
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'link', url: link.href }));
        return;
      }

      var fileCard = closestFrom(e.target, '.file-card');
      if (fileCard && window.ReactNativeWebView && !closestFrom(e.target, '.block-remove-button')) {
        e.preventDefault();
        var titleEl = fileCard.querySelector('.file-title');
        var title = titleEl ? titleEl.innerText : '';
        var isPdfCard = fileCard.innerHTML.toLowerCase().includes('pdf');
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'media', mediaType: 'file', url: fileCard.href, title: title, isPdf: isPdfCard }));
        return;
      }

      var pdfOverlay = closestFrom(e.target, '.pdf-click-overlay');
      if (pdfOverlay && window.ReactNativeWebView) {
        e.preventDefault();
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'media', mediaType: 'file', url: pdfOverlay.dataset.rawUrl, title: 'PDF', isPdf: true }));
        return;
      }

      var continuation = closestFrom(e.target, 'p.composer-continuation');
      if (continuation) {
        clearSelectedMathAtom();
        if (Date.now() - lastContinuationFocusAt > 250) {
          focusContinuation(continuation);
        }
        return;
      }

      clearSelectedMathAtom();

      const menuButton = closestFrom(e.target, '[data-table-menu]');
      if (menuButton) {
        e.preventDefault();
        suppressControlCaret();
        const shell = menuButton.closest('.note-table-shell');
        if (shell) {
          showTableMenu(shell, menuButton);
        }
        return;
      }

      const tableClick = closestFrom(e.target, 'table.note-table');
      if (tableClick && !closestFrom(e.target, '.note-table-controls')) {
        const shell = tableClick.closest('.note-table-shell');
        if (shell) {
          const tb = shell.querySelector('.note-table-controls');
          if (tb && tb.style.display === 'none') {
            tb.style.display = '';
            shell.classList.remove('is-collapsed');
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'haptic', style: 'selection' }));
          }
        }
      }

      const menuItem = closestFrom(e.target, '.note-table-menu-item');
      if (menuItem) {
        e.preventDefault();
        suppressControlCaret();
        if (menuItem.disabled) return;
        const shell = menuItem.closest('.note-table-shell');
        const popover = menuItem.closest('.note-table-popover');
        if (shell && popover) {
          deleteTablePart(shell, popover.dataset.type, Number(popover.dataset.index || 0));
        }
        return;
      }

      const tableButton = closestFrom(e.target, '[data-table-action]');
      if (!tableButton) {
        hideTableMenus();
        return;
      }

      e.preventDefault();
      const shell = tableButton.closest('.note-table-shell');
      const table = shell ? shell.querySelector('table.note-table') : null;
      if (!table) {
        return;
      }

      if (tableButton.dataset.tableAction === 'close-menu') {
        hideTableMenus();
        const tb = shell.querySelector('.note-table-controls');
        if (tb) tb.style.display = 'none';
        shell.classList.add('is-collapsed');
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'haptic', style: 'success' }));
        placeCaretAfterTable(shell);
        return;
      }

      if (tableButton.dataset.tableAction === 'delete-table') {
        hideTableMenus();
        removeAtomicBlock(shell);
        return;
      }

      if (tableButton.dataset.tableAction === 'add-row') {
        const row = table.insertRow(-1);
        const colCount = Math.max(table.rows[0]?.cells.length || 2, 1);
        for (let i = 0; i < colCount; i += 1) {
          const cell = row.insertCell(-1);
          cell.setAttribute('contenteditable', 'true');
          cell.innerHTML = '<br>';
        }
        syncTableHandles(shell);
        placeCaretInNode(row.cells[0]);
      }

      if (tableButton.dataset.tableAction === 'add-col') {
        let targetCell = null;
        Array.from(table.rows).forEach(function(row) {
          const cell = row.insertCell(-1);
          cell.setAttribute('contenteditable', 'true');
          cell.innerHTML = '<br>';
          if (!targetCell) targetCell = cell;
        });
        syncTableHandles(shell);
        placeCaretInNode(targetCell);
      }

      syncTableHandles(shell);
      requestAnimationFrame(function() {
        syncTableHandles(shell);
      });
      notifyChange();
    });

    editor.addEventListener('pointerup', function(e) {
      const continuation = closestFrom(e.target, 'p.composer-continuation');
      if (continuation) {
        e.preventDefault();
        focusContinuation(continuation);
        getActiveStyles();
        return;
      }

      if (e.target !== editor) return;

      const blocks = Array.from(editor.querySelectorAll(ATOMIC_BLOCK_SELECTOR));
      const block = blocks.reverse().find(function(item) {
        const rect = item.getBoundingClientRect();
        return e.clientY >= rect.bottom - 4 && e.clientY <= rect.bottom + 72;
      });

      if (block) {
        focusContinuation(ensureParagraphAfter(block));
      }
    });

    // Paste handler: sanitize external content to match app styling
    editor.addEventListener('paste', function(e) {
      e.preventDefault();
      var clipboardData = e.clipboardData || window.clipboardData;
      var html = clipboardData.getData('text/html');
      var text = clipboardData.getData('text/plain');

      if (html) {
        // Parse the pasted HTML
        var temp = document.createElement('div');
        temp.innerHTML = html;

        // Remove all style attributes, class attributes, and data attributes
        var allElements = temp.querySelectorAll('*');
        for (var i = 0; i < allElements.length; i++) {
          var el = allElements[i];
          el.removeAttribute('style');
          el.removeAttribute('class');
          el.removeAttribute('id');
          // Remove data attributes
          var attrs = Array.from(el.attributes);
          for (var j = 0; j < attrs.length; j++) {
            if (attrs[j].name.startsWith('data-')) {
              el.removeAttribute(attrs[j].name);
            }
          }
        }

        // Remove disallowed tags but keep their text content
        var disallowed = temp.querySelectorAll('script, style, meta, link, object, embed, form, input, button, select, textarea, svg, canvas, colgroup, col, caption, details, summary, dialog, nav, header, footer, main, section, article, aside, address, font, center, marquee, blink');
        for (var k = 0; k < disallowed.length; k++) {
          var parent = disallowed[k].parentNode;
          if (parent) {
            // For font/center tags, keep inner content
            var tag = disallowed[k].tagName.toLowerCase();
            if (tag === 'font' || tag === 'center') {
              while (disallowed[k].firstChild) {
                parent.insertBefore(disallowed[k].firstChild, disallowed[k]);
              }
            }
            parent.removeChild(disallowed[k]);
          }
        }

        // Convert heading tags h3-h6 to h2
        var lowerHeadings = temp.querySelectorAll('h3, h4, h5, h6');
        for (var m = 0; m < lowerHeadings.length; m++) {
          var h2 = document.createElement('h2');
          h2.innerHTML = lowerHeadings[m].innerHTML;
          lowerHeadings[m].parentNode.replaceChild(h2, lowerHeadings[m]);
        }

        // Convert div/span to p or inline text
        var divs = temp.querySelectorAll('div');
        for (var n = divs.length - 1; n >= 0; n--) {
          var p = document.createElement('p');
          p.innerHTML = divs[n].innerHTML;
          divs[n].parentNode.replaceChild(p, divs[n]);
        }

        var spans = temp.querySelectorAll('span');
        for (var s = spans.length - 1; s >= 0; s--) {
          var spanParent = spans[s].parentNode;
          while (spans[s].firstChild) {
            spanParent.insertBefore(spans[s].firstChild, spans[s]);
          }
          spanParent.removeChild(spans[s]);
        }

        var tables = temp.querySelectorAll('table');
        for (var t = 0; t < tables.length; t++) {
          tables[t].className = 'note-table';
          tables[t].setAttribute('contenteditable', 'true');
          if (!tables[t].parentElement || !tables[t].parentElement.classList.contains('note-table-scroll')) {
            var shell = document.createElement('div');
            shell.className = 'note-table-shell';
            shell.setAttribute('contenteditable', 'false');
            var controls = document.createElement('div');
            controls.className = 'note-table-controls';
            controls.innerHTML = '<div class="note-table-control-group"><button type="button" contenteditable="false" class="note-table-control" data-table-action="add-row">+ Satır</button><button type="button" contenteditable="false" class="note-table-control" data-table-action="add-col">+ Sütun</button></div><div class="note-table-control-group"><button type="button" contenteditable="false" class="note-table-control danger" data-table-action="delete-table">' + ICONS.trash + '</button><button type="button" contenteditable="false" class="note-table-control" data-table-action="close-menu">' + ICONS.check + '</button></div>';
            var scroll = document.createElement('div');
            scroll.className = 'note-table-scroll';
            tables[t].parentNode.insertBefore(shell, tables[t]);
            shell.appendChild(controls);
            shell.appendChild(scroll);
            scroll.appendChild(tables[t]);
          }
        }

        var cleanHtml = temp.innerHTML;
        document.execCommand('insertHTML', false, cleanHtml);
      } else if (text) {
        // Plain text: convert line breaks to paragraphs
        var lines = text.split(/\\n/);
        var result = lines.map(function(line) {
          return line.trim() ? '<p>' + line.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>' : '<p><br></p>';
        }).join('');
        document.execCommand('insertHTML', false, result);
      }

      notifyChange();
      requestAnimationFrame(syncAllTables);
      requestAnimationFrame(updateScrollShadows);
    });

    editor.addEventListener('focus', () => {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'focus' }));
      if (pendingColor) {
         document.execCommand('styleWithCSS', false, true);
         document.execCommand('foreColor', false, pendingColor);
         updateCaretColor(pendingColor);
         pendingColor = null;
      }
      if (isEditorEmpty()) {
        placeCaretInNode(editor);
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
      stabilizeCaretAfterKeyboard({
        afterKeyboard: true,
        pin: Date.now() - lastContinuationFocusAt < 900,
        target: activeCaretElement
      });
      getActiveStyles();
    });

    editor.addEventListener('blur', () => {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'blur' }));
    });

    // Command handler from React Native
    window.executeCommand = function(command, value, preventFocus) {
      if (command === 'saveSelection') {
        saveSelection();
        return;
      }

      if (command === 'setContent') {
        editor.innerHTML = value || '';
        lastContent = editor.innerHTML;
        savedRange = null;
        requestAnimationFrame(function() {
          syncAllTables();
          hydrateDrawings();
          
          Array.from(editor.querySelectorAll('.note-table-shell')).forEach(function(shell) {
            shell.classList.add('is-collapsed');
            var tb = shell.querySelector('.note-table-controls');
            if (tb) tb.style.display = 'none';
          });
          
          Array.from(editor.querySelectorAll('[data-table-action="add-row"]')).forEach(function(btn) {
            btn.innerHTML = '+ Satır';
          });
          
          Array.from(editor.querySelectorAll('[data-table-action="add-col"]')).forEach(function(btn) {
            btn.innerHTML = '+ Sütun';
          });
          
          Array.from(editor.querySelectorAll('.drawing-card[data-has-drawing="true"]')).forEach(function(card) {
            card.style.background = 'transparent';
            card.style.padding = '0';
            var tb = card.querySelector('.drawing-toolbar');
            if (tb) tb.style.display = 'none';
            var surface = card.querySelector('.drawing-surface');
            if (surface) surface.style.display = 'none';
            var canvas = card.querySelector('.drawing-canvas');
            if (canvas) canvas.style.display = 'none';
            var img = card.querySelector('.drawing-image');
            if (img) img.style.display = 'block';
          });
          
          normalizeAtomicContinuations();
          updateScrollShadows();
          notifyChange();
        });
        return;
      }

      if (command === 'setPlaceholder') {
        editor.setAttribute('data-placeholder', value || '');
        return;
      }

      if (command === 'getContent') {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'getContent',
          content: serializeEditorContent()
        }));
        return;
      }

      if (command === 'focus') {
        editor.focus();
        restoreSelection();
        revealCaretAfterKeyboard();
        return;
      }

      if (command === 'blur') {
        saveSelection();
        editor.blur();
        return;
      }

      if (command === 'updateMediaPreview') {
        const payload = JSON.parse(value || '{}');
        if (!payload.localId || !payload.uri) return;
        const card = editor.querySelector('.media-card[data-local-id="' + escapeAttr(payload.localId) + '"]');
        if (!card) return;
        const media = card.querySelector('img, video');
        if (media) {
          media.setAttribute('src', payload.type === 'video' ? getVideoSourceForPreview(payload.uri) : payload.uri);
        }
        card.setAttribute('data-preview-uri', payload.uri);
        notifyChange();
        return;
      }

      if (command === 'updateMedia') {
        const payload = JSON.parse(value || '{}');
        if (!payload.localId) return;
        const card = editor.querySelector('.media-card[data-local-id="' + escapeAttr(payload.localId) + '"]');
        if (!card) return;

        const media = card.querySelector('img, video');
        if (media && payload.uri) {
          card.setAttribute('data-remote-url', payload.uri);
          if (!card.getAttribute('data-preview-uri')) {
            media.setAttribute('src', payload.type === 'video' ? getVideoSourceForPreview(payload.uri) : payload.uri);
          }
        }
        if (payload.type === 'pdf' && payload.uri) {
          card.setAttribute('data-remote-url', payload.uri);
          card.setAttribute('data-raw-url', payload.uri);
          const overlay = card.querySelector('.pdf-click-overlay');
          if (overlay) overlay.setAttribute('data-raw-url', payload.uri);
          const iframe = card.querySelector('iframe');
          if (iframe) iframe.setAttribute('src', getPdfPreviewSource(payload.uri));
        }
        if (media && payload.width && payload.height) {
          const nextWidth = Number(payload.width);
          const nextHeight = Number(payload.height);
          if (nextWidth > 0 && nextHeight > 0) {
            media.setAttribute('width', String(Math.round(nextWidth)));
            media.setAttribute('height', String(Math.round(nextHeight)));
          }
        }

        if (payload.type) {
          card.setAttribute('data-media-type', payload.type);
        }
        if (payload.sha256) {
          card.setAttribute('data-sha256', payload.sha256);
        }
        if (payload.metadataEventId) {
          card.setAttribute('data-metadata-event', payload.metadataEventId);
        }
        if (payload.server) {
          card.setAttribute('data-blossom-server', payload.server);
        }
        card.classList.remove('is-uploading');
        notifyChange();
        return;
      }

      if (!preventFocus) {
        editor.focus();
      }

      restoreSelection();

      if (applyMathFormattingCommand(command, value)) {
        saveSelection();
        return;
      }

      switch(command) {
        case 'saveSelection':
          saveSelection();
          break;
        case 'focus':
          editor.focus({ preventScroll: true });
          break;
        case 'blur':
          saveSelection();
          editor.blur();
          titleInput.blur();
          break;
        case 'bold':
          document.execCommand('bold', false, null);
          break;
        case 'italic':
          document.execCommand('italic', false, null);
          break;
        case 'underline':
          document.execCommand('underline', false, null);
          break;
        case 'strikethrough':
          document.execCommand('strikeThrough', false, null);
          break;
        case 'heading1':
          document.execCommand('formatBlock', false, '<h1>');
          break;
        case 'heading2':
          document.execCommand('formatBlock', false, '<h2>');
          break;
        case 'paragraph':
          document.execCommand('formatBlock', false, '<p>');
          break;
        case 'bulletList':
          document.execCommand('insertUnorderedList', false, null);
          break;
        case 'orderedList':
          document.execCommand('insertOrderedList', false, null);
          break;
        case 'removeFormat':
          document.execCommand('removeFormat', false, null);
          pendingColor = null;
          updateCaretColor(DEFAULT_CARET_COLOR);
          break;
        case 'undo':
          document.execCommand('undo', false, null);
          break;
        case 'redo':
          document.execCommand('redo', false, null);
          break;
        case 'indent':
          document.execCommand('indent', false, null);
          break;
        case 'outdent':
          document.execCommand('outdent', false, null);
          break;
        case 'foreColor':
          if (editor.innerText.trim() === '') {
             editor.innerHTML = '<span style="color: ' + value + ';">&#8203;</span>';
             var range = document.createRange();
             var sel = window.getSelection();
             range.selectNodeContents(editor.firstChild);
             range.collapse(false);
             sel.removeAllRanges();
             sel.addRange(range);
             savedRange = range.cloneRange();
             pendingColor = value;
             updateCaretColor(value);
          } else {
             var currentSelection = window.getSelection();
             var hasTextSelection = currentSelection && currentSelection.rangeCount > 0 && !currentSelection.isCollapsed;
             if (hasTextSelection) {
               applyColorToRange(value);
               pendingColor = value;
             } else {
               pendingColor = value;
               if (document.activeElement === editor || editor.contains(document.activeElement)) {
                 document.execCommand('styleWithCSS', false, true);
                 document.execCommand('foreColor', false, value);
               }
             }
             updateCaretColor(value);
          }
          break;
        case 'checkList':
          // Standard execCommand doesn't support checklists natively.
          // Fallback to bullet list for now or we could inject a custom ul class.
          document.execCommand('insertUnorderedList', false, null);
          break;
        case 'insertLink':
          if (value) {
            const data = JSON.parse(value);
            const linkHtml = '<a href="' + escapeAttr(data.url) + '">' + escapeHtml(data.text || data.url) + '</a>';
            document.execCommand('insertHTML', false, linkHtml);
          }
          break;
        case 'insertTable':
          insertAtomicBlockAtSelection(buildTable(2, 2));
          break;
        case 'insertMathBlock':
          insertHtmlAtSelection('<p>$$E = mc^2$$</p><p><br></p>');
          break;
        case 'insertRenderedLatex':
          insertRenderedLatexPayload(value);
          break;
        case 'replaceSelectedLatex':
          replaceSelectedLatexPayload(value);
          break;
        case 'applyLatexPower':
          insertHtmlAtSelection(buildPowerMathHtml(consumeLatexBaseBeforeCaret(), value || '2') + '&nbsp;');
          break;
        case 'insertLatex':
          if (value) {
            insertHtmlAtSelection(escapeHtml(value) + '&nbsp;');
          }
          break;
        case 'insertMedia':
          insertMediaFromPayload(value);
          break;
        case 'insertFile':
          insertFileFromPayload(value);
          break;
        case 'insertDrawing':
          insertAtomicBlockAtSelection(buildDrawing());
          break;
      }

      // Update active styles after command
      saveSelection();
      setTimeout(getActiveStyles, 50);
      notifyChange();
    };

    // Initial focus signal
    setTimeout(() => {
      syncAllTables();
      hydrateDrawings();
      normalizeAtomicContinuations();
      updateScrollShadows();
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
    }, 100);
  </script>
</body>
</html>
`;

export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  ({ initialTitle = '', initialContent, placeholder = '', onTitleChange, onChange, onFocus, onBlur, onUploadProgress, style }, ref) => {
    const { t } = useI18n();
    const { colors, scheme } = useAppTheme();

    const webviewSource = useMemo(() => {
      let html = EDITOR_HTML;
      const drawingCanvasBackground = scheme === 'light' ? '#FFFFFF' : '#111113';
      const drawingGridColor = scheme === 'light' ? 'rgba(17,17,20,0.075)' : 'rgba(255,255,255,0.055)';
      const drawingPrimaryColor = scheme === 'light' ? '#111114' : '#FFFFFF';
      const scrollbarThumb = scheme === 'light' ? '#C8CDD6' : '#2C2C2E';
      const scrollbarThumbHover = scheme === 'light' ? '#B5BBC6' : '#3A3A3C';

      html = html.replace(/\+ Satır/g, '+ ' + t('editor.table.row'));
      html = html.replace(/\+ Sütun/g, '+ ' + t('editor.table.column'));
      html = html.replace(/Satırı Sil/g, t('editor.table.deleteRow'));
      html = html.replace(/Sütunu Sil/g, t('editor.table.deleteColumn'));
      html = html.replace(/>Satır</g, '>' + t('editor.table.row') + '<');
      html = html.replace(/>Sütun</g, '>' + t('editor.table.column') + '<');
      html = html.replace(/placeholder="Başlık"/g, 'placeholder="' + t('editor.titlePlaceholder') + '"');
      html = html.replace(/data-placeholder="Yazmaya başlayın..."/g, 'data-placeholder="' + t('editor.placeholder') + '"');
      html = html.replace(/data-drawing-color="#FFFFFF" style="background:#FFFFFF"/g, `data-drawing-color="${drawingPrimaryColor}" style="background:${drawingPrimaryColor}"`);
      html = html.replace(/let activeColor = '#FFFFFF';/g, `let activeColor = '${drawingPrimaryColor}';`);
      html = html.replace(/exportContext\.fillStyle = '#000000';/g, `exportContext.fillStyle = '${drawingCanvasBackground}';`);
      html = html.replace(/const DEFAULT_CARET_COLOR = '#FFFFFF';/g, `const DEFAULT_CARET_COLOR = '${colors.text}';`);
      html = html.replace('</style>', `
    html, body {
      background-color: ${colors.background} !important;
      color-scheme: ${scheme};
      scrollbar-color: ${scrollbarThumb} transparent !important;
      --editor-caret-color: ${colors.text};
    }
    ::-webkit-scrollbar-thumb,
    #editor .note-table-scroll::-webkit-scrollbar-thumb {
      background: ${scrollbarThumb} !important;
    }
    ::-webkit-scrollbar-thumb:hover,
    #editor .note-table-scroll::-webkit-scrollbar-thumb:hover {
      background: ${scrollbarThumbHover} !important;
    }
    #editor-scroll-indicator {
      background: ${scrollbarThumb} !important;
    }
    #note-title {
      color: ${colors.text} !important;
    }
    #note-title::placeholder,
    #editor:empty::before {
      color: ${colors.placeholder} !important;
    }
    #editor {
      color: ${colors.text} !important;
      caret-color: var(--editor-caret-color, ${colors.text}) !important;
    }
    #editor .math-inline,
    #editor .math-display {
      color: inherit;
      font-family: inherit !important;
      font-size: 1em;
      line-height: inherit;
      max-width: 100%;
      cursor: pointer;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    #editor .math-inline {
      display: inline-flex;
      align-items: baseline;
      vertical-align: baseline;
      overflow: visible;
      padding: 0.12em 0.08em;
      margin-inline: 0.06em;
      border-radius: 6px;
    }
    #editor .math-display {
      display: block;
      width: 100%;
      margin: 12px 0;
      padding: 12px 14px;
      border: 1px solid ${colors.border};
      border-radius: 14px;
      background: ${colors.elevated};
      overflow-x: auto;
      overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
    }
    #editor .math-inline::-webkit-scrollbar,
    #editor .math-display::-webkit-scrollbar {
      display: none;
      width: 0;
      height: 0;
    }
    #editor .math-inline.is-selected,
    #editor .math-display.is-selected {
      outline: 2px solid ${colors.accent};
      outline-offset: 2px;
      background: ${scheme === 'light' ? 'rgba(10,132,255,0.10)' : 'rgba(10,132,255,0.16)'} !important;
    }
    #editor .math-inline *,
    #editor .math-display * {
      color: inherit !important;
      font-family: inherit !important;
      line-height: inherit !important;
      font-weight: inherit !important;
      font-style: inherit !important;
    }
    #editor .math-inline .katex,
    #editor .math-display .katex {
      font-family: inherit !important;
      font-size: 1em !important;
      line-height: inherit !important;
    }
    #editor .math-inline .katex {
      display: inline-flex;
      align-items: baseline;
      vertical-align: baseline;
    }
    #editor .math-inline math,
    #editor .math-display math {
      font-family: inherit !important;
      font-size: 1em !important;
      math-style: compact;
      font-weight: inherit !important;
      font-style: inherit !important;
      overflow: visible;
    }
    #editor .math-inline math {
      vertical-align: baseline;
    }
    #editor .math-inline mtext,
    #editor .math-display mtext {
      font-family: inherit !important;
      font-size: 1em;
      font-weight: inherit !important;
      font-style: inherit !important;
    }
    #editor blockquote {
      color: ${colors.textSecondary} !important;
    }
    #editor code {
      background: ${colors.elevatedMuted} !important;
    }
    #editor pre,
    #editor .note-table-shell,
    #editor .file-card,
    #editor .pdf-viewer-card {
      background: ${colors.elevated} !important;
      border-color: ${colors.border} !important;
    }
    #editor .note-table-controls,
    #editor .note-table-column-handles,
    #editor .note-table-row-handles,
    #editor .note-table-popover,
    #editor .pdf-card-header {
      background: ${colors.elevatedMuted} !important;
      border-color: ${colors.border} !important;
    }
    #editor .note-table-handle,
    #editor .note-table-menu-item,
    #editor .note-table-control {
      color: ${colors.text} !important;
      background: ${colors.elevatedMuted} !important;
      border-color: ${colors.border} !important;
    }
    #editor .note-table-control[data-table-action="add-row"],
    #editor .note-table-control[data-table-action="add-col"] {
      color: #FFFFFF !important;
      background: ${colors.accent} !important;
      border-color: ${colors.accent} !important;
    }
    #editor .note-table-control.danger {
      color: ${colors.destructive} !important;
      background: ${scheme === 'light' ? 'rgba(217,45,32,0.10)' : 'rgba(255,69,58,0.14)'} !important;
      border-color: ${scheme === 'light' ? 'rgba(217,45,32,0.18)' : 'rgba(255,69,58,0.22)'} !important;
    }
    #editor .note-table td,
    #editor .note-table th {
      color: ${colors.text} !important;
      caret-color: var(--editor-caret-color, ${colors.text}) !important;
      background: ${colors.inputBackground} !important;
      border-color: ${colors.border} !important;
    }
    #editor .note-table tr:first-child td,
    #editor .note-table th,
    #editor .note-table td:focus,
    #editor .note-table th:focus {
      background: ${colors.elevatedMuted} !important;
    }
    #editor .drawing-card {
      background: ${colors.elevated} !important;
      border-color: ${colors.border} !important;
    }
    #editor .drawing-surface {
      background:
        linear-gradient(${drawingGridColor} 1px, transparent 1px),
        linear-gradient(90deg, ${drawingGridColor} 1px, transparent 1px),
        ${drawingCanvasBackground} !important;
      background-size: 24px 24px !important;
      border-color: ${colors.border} !important;
    }
    #editor .drawing-image {
      background: ${drawingCanvasBackground} !important;
    }
    #editor .drawing-action {
      color: ${colors.text} !important;
      background: ${colors.iconBackground} !important;
      border: 1px solid ${colors.border} !important;
    }
    #editor .drawing-action.primary {
      color: #FFFFFF !important;
      background: ${colors.accent} !important;
      border-color: ${colors.accent} !important;
    }
    #editor .drawing-color {
      border-color: ${colors.border} !important;
    }
    #editor .file-title,
    #editor .pdf-title {
      color: ${colors.text} !important;
    }
    #editor .file-meta {
      color: ${colors.textSecondary} !important;
    }
  </style>`);
      return { html };
    }, [colors.accent, colors.background, colors.border, colors.destructive, colors.elevated, colors.elevatedMuted, colors.iconBackground, colors.inputBackground, colors.placeholder, colors.text, colors.textSecondary, scheme, t]);

    const webViewRef = useRef<WebViewRef>(null);
    const formatSheetRef = useRef<FormatBottomSheetRef>(null);
    const attachmentSheetRef = useRef<ActionBottomSheetRef>(null);
    const moreSheetRef = useRef<ActionBottomSheetRef>(null);
    const linkSheetRef = useRef<LinkBottomSheetRef>(null);
    const [activeStyles, setActiveStyles] = useState<string[]>([]);
    const [activeTextColor, setActiveTextColor] = useState(colors.text);
    const [isReady, setIsReady] = useState(false);
    const isPickingRef = useRef(false);
    const [isFocused, setIsFocused] = useState(false);
    const contentRef = useRef('');
    const titleRef = useRef('');
    const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const sheetTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const pendingContentRequestRef = useRef<{
      resolve: (content: string) => void;
      timeout: ReturnType<typeof setTimeout>;
    } | null>(null);
    const uploadControllersRef = useRef<Map<string, AbortController>>(new Map());
    const uploadProgressTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>[]>>(new Map());
    const sheetRequestIdRef = useRef(0);
    const activeSheetRef = useRef<'format' | 'attachment' | 'more' | 'link' | null>(null);
    const [previewDocument, setPreviewDocument] = useState<{ url: string, title?: string, isPdf?: boolean } | null>(null);
    const [fileActionTarget, setFileActionTarget] = useState<(PdfActionTarget & { isPdf?: boolean }) | null>(null);
    const [formulaSheetVisible, setFormulaSheetVisible] = useState(false);
    const [formulaDraft, setFormulaDraft] = useState<{
      mode: FormulaSheetMode;
      values: FormulaValues;
      replaceSelected: boolean;
    }>({
      mode: 'power',
      values: {},
      replaceSelected: false,
    });

    const clearUploadProgressTimers = useCallback((id: string) => {
      const timers = uploadProgressTimersRef.current.get(id);
      if (timers) {
        timers.forEach((timer) => clearTimeout(timer));
        uploadProgressTimersRef.current.delete(id);
      }
    }, []);

    const scheduleUploadProgress = useCallback((id: string, label: string, signal: AbortSignal) => {
      clearUploadProgressTimers(id);
      const steps = [
        { delay: 220, percent: 12 },
        { delay: 620, percent: 21 },
        { delay: 1180, percent: 34 },
        { delay: 1900, percent: 47 },
        { delay: 2860, percent: 61 },
        { delay: 4200, percent: 74 },
        { delay: 6100, percent: 86 },
        { delay: 8200, percent: 93 },
      ];
      const timers = steps.map(({ delay, percent }) => setTimeout(() => {
        if (!signal.aborted) {
          onUploadProgress?.({ id, label, percent });
        }
      }, delay));
      uploadProgressTimersRef.current.set(id, timers);
    }, [clearUploadProgressTimers, onUploadProgress]);

    const finishUploadProgress = useCallback((id: string, label: string) => {
      clearUploadProgressTimers(id);
      onUploadProgress?.({ id, label, percent: 96 });
      setTimeout(() => {
        onUploadProgress?.({ id, label, percent: 100 });
        setTimeout(() => onUploadProgress?.(null), 650);
      }, 180);
    }, [clearUploadProgressTimers, onUploadProgress]);

    const execCommand = useCallback((command: string, value?: string, preventFocus?: boolean) => {
      const commandArg = JSON.stringify(command);
      const valueArg = value === undefined ? 'null' : JSON.stringify(value);
      webViewRef.current?.injectJavaScript(`
        if (window.executeCommand) {
          window.executeCommand(${commandArg}, ${valueArg}, ${preventFocus ? 'true' : 'false'});
        }
        true;
      `);
    }, []);

    const insertRenderedLatex = useCallback((tex: string) => {
      const payload = buildLatexPayload(tex);
      if (payload) {
        execCommand('insertRenderedLatex', payload);
      }
    }, [execCommand]);

    const applyLatexPower = useCallback((exponent: string) => {
      execCommand('applyLatexPower', sanitizeLatexAtom(exponent, '2'));
    }, [execCommand]);

    const openFormulaSheet = useCallback((mode: FormulaSheetMode) => {
      execCommand('saveSelection', undefined, true);
      execCommand('blur', undefined, true);
      Keyboard.dismiss();
      setFormulaDraft({ mode, values: {}, replaceSelected: false });
      setFormulaSheetVisible(true);
    }, [execCommand]);

    const handleFormulaSubmit = useCallback((tex: string) => {
      const payload = buildLatexPayload(tex);
      if (!payload) return;
      if (formulaDraft.replaceSelected) {
        execCommand('replaceSelectedLatex', payload);
        return;
      }
      execCommand('insertRenderedLatex', payload);
    }, [execCommand, formulaDraft.replaceSelected]);

    const closeFormulaSheet = useCallback(() => {
      setFormulaSheetVisible(false);
      setFormulaDraft({ mode: 'power', values: {}, replaceSelected: false });
    }, []);

    const prepareForSheet = useCallback(() => {
      execCommand('saveSelection', undefined, true);
      execCommand('blur', undefined, true);
      Keyboard.dismiss();
    }, [execCommand]);

    const closeSheets = useCallback((except?: 'format' | 'attachment' | 'more' | 'link') => {
      if (activeSheetRef.current && activeSheetRef.current !== except) {
        if (activeSheetRef.current === 'format') formatSheetRef.current?.close();
        if (activeSheetRef.current === 'attachment') attachmentSheetRef.current?.close();
        if (activeSheetRef.current === 'more') moreSheetRef.current?.close();
        if (activeSheetRef.current === 'link') linkSheetRef.current?.close();
        activeSheetRef.current = null;
      }
    }, []);

    const openSheetAfterKeyboard = useCallback((target: 'format' | 'attachment' | 'more' | 'link', open: () => void) => {
      if (sheetTimerRef.current) {
        clearTimeout(sheetTimerRef.current);
      }
      const requestId = sheetRequestIdRef.current + 1;
      sheetRequestIdRef.current = requestId;
      activeSheetRef.current = target;
      sheetTimerRef.current = setTimeout(() => {
        if (sheetRequestIdRef.current !== requestId || activeSheetRef.current !== target) {
          return;
        }
        open();
      }, Platform.OS === 'web' ? 0 : 16);
    }, []);

    const openFormatSheet = useCallback(() => {
      prepareForSheet();
      closeSheets('format');
      openSheetAfterKeyboard('format', () => {
        formatSheetRef.current?.open();
      });
    }, [closeSheets, openSheetAfterKeyboard, prepareForSheet]);

    const openAttachmentSheet = useCallback(() => {
      prepareForSheet();
      closeSheets('attachment');
      openSheetAfterKeyboard('attachment', () => {
        attachmentSheetRef.current?.open();
      });
    }, [closeSheets, openSheetAfterKeyboard, prepareForSheet]);

    const openMoreSheet = useCallback(() => {
      prepareForSheet();
      closeSheets('more');
      openSheetAfterKeyboard('more', () => {
        moreSheetRef.current?.open();
      });
    }, [closeSheets, openSheetAfterKeyboard, prepareForSheet]);

    const openLinkSheet = useCallback(() => {
      prepareForSheet();
      closeSheets('link');
      openSheetAfterKeyboard('link', () => {
        linkSheetRef.current?.open();
      });
    }, [closeSheets, openSheetAfterKeyboard, prepareForSheet]);

    const dismissEditorKeyboard = useCallback(() => {
      execCommand('blur', undefined, true);
      Keyboard.dismiss();
      setIsFocused(false);
      setTimeout(() => Keyboard.dismiss(), 40);
      setTimeout(() => Keyboard.dismiss(), 140);
    }, [execCommand]);

    const uploadMediaAsset = useCallback(async (asset: any) => {
      const isVideo = asset.type === 'video' || asset.mimeType?.startsWith('video');
      const localId = 'media_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const uploadLabel = isVideo ? 'Video' : 'Görsel';
      const initialPreviewUri = getImmediateMediaPreviewUri(asset, isVideo);
      const keepInitialPreview = Boolean(initialPreviewUri);
      const initialPreviewIsDataUrl = String(initialPreviewUri || '').startsWith('data:');
      const controller = new AbortController();
      uploadControllersRef.current.set(localId, controller);

      execCommand('insertMedia', JSON.stringify({
        uri: initialPreviewUri,
        localId,
        type: isVideo ? 'video' : 'image',
        width: asset.width,
        height: asset.height,
        fileName: asset.fileName || asset.name || 'media',
        mimeType: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
        size: asset.fileSize,
        keepLocalPreview: keepInitialPreview,
        isUploading: false
      }));
      onUploadProgress?.({
        id: localId,
        label: uploadLabel,
        percent: 6,
      });
      scheduleUploadProgress(localId, uploadLabel, controller.signal);

      try {
        const cachedPreviewUri = await cacheMediaPreview(asset, isVideo, localId);
        const uploadUri = cachedPreviewUri || asset.uri;

        if (cachedPreviewUri && cachedPreviewUri !== initialPreviewUri && !initialPreviewIsDataUrl) {
          execCommand('updateMediaPreview', JSON.stringify({
            localId,
            uri: cachedPreviewUri,
            type: isVideo ? 'video' : 'image'
          }), true);
        }

        const upload = await nostrService.uploadBlossomFile({
          uri: uploadUri,
          name: asset.fileName || asset.name || 'media',
          mimeType: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
          size: asset.fileSize,
          width: asset.width,
          height: asset.height,
          alt: asset.fileName || asset.name,
          file: asset.file,
          signal: controller.signal
        });
        if (upload) {
          execCommand('updateMedia', JSON.stringify({
            localId,
            uri: upload.url,
            type: isVideo ? 'video' : 'image',
            width: upload.width,
            height: upload.height,
            name: upload.name,
            mimeType: upload.mimeType,
            size: upload.size,
            sha256: upload.sha256,
            metadataEventId: upload.metadataEventId,
            server: upload.server
          }));
          finishUploadProgress(localId, uploadLabel);
        } else {
          clearUploadProgressTimers(localId);
          onUploadProgress?.(null);
          showAppAlert('Hata', 'Medya yüklenemedi.');
        }
      } catch (e) {
        clearUploadProgressTimers(localId);
        if (controller.signal.aborted) {
          return;
        }
        console.error(e);
        onUploadProgress?.(null);
        showAppAlert('Hata', 'Medya yüklenemedi.');
      } finally {
        uploadControllersRef.current.delete(localId);
        clearUploadProgressTimers(localId);
        if (controller.signal.aborted) {
          onUploadProgress?.(null);
        }
      }
    }, [clearUploadProgressTimers, execCommand, finishUploadProgress, onUploadProgress, scheduleUploadProgress]);

    const uploadDocumentAsset = useCallback(async (asset: any) => {
      const localId = 'file_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const isInitialPdf = asset.mimeType?.startsWith('application/pdf') || asset.name?.toLowerCase().includes('.pdf');
      const uploadLabel = isInitialPdf ? 'PDF' : 'Dosya';
      const controller = new AbortController();
      uploadControllersRef.current.set(localId, controller);

      if (isInitialPdf) {
        execCommand('insertMedia', JSON.stringify({
          uri: asset.uri,
          localId,
          type: 'pdf',
          name: asset.name || 'PDF',
          mimeType: asset.mimeType || 'application/pdf',
          size: asset.size,
          isUploading: false
        }));
      }

      onUploadProgress?.({
        id: localId,
        label: uploadLabel,
        percent: 6,
      });
      scheduleUploadProgress(localId, uploadLabel, controller.signal);

      try {
        const upload = await nostrService.uploadBlossomFile({
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType || 'application/octet-stream',
          size: asset.size,
          alt: asset.name,
          signal: controller.signal
        });
        if (upload) {
          const isPdf = asset.mimeType?.startsWith('application/pdf') || upload.mimeType?.startsWith('application/pdf') || asset.name?.toLowerCase().includes('.pdf');

          const uploadedPayload = JSON.stringify({
            localId,
            uri: upload.url,
            type: isPdf ? 'pdf' : 'file',
            name: upload.name,
            mimeType: upload.mimeType,
            size: upload.size,
            sha256: upload.sha256,
            metadataEventId: upload.metadataEventId,
            server: upload.server
          });

          if (isPdf && isInitialPdf) {
            execCommand('updateMedia', uploadedPayload);
          } else if (isPdf) {
            execCommand('insertMedia', uploadedPayload);
          } else {
            execCommand('insertFile', uploadedPayload);
          }

          finishUploadProgress(localId, isPdf ? 'PDF' : 'Dosya');
        } else {
          clearUploadProgressTimers(localId);
          onUploadProgress?.(null);
          showAppAlert('Hata', 'Dosya yüklenemedi.');
        }
      } catch (e) {
        clearUploadProgressTimers(localId);
        if (controller.signal.aborted) {
          return;
        }
        console.error(e);
        onUploadProgress?.(null);
        showAppAlert('Hata', 'Dosya yüklenemedi.');
      } finally {
        uploadControllersRef.current.delete(localId);
        clearUploadProgressTimers(localId);
        if (controller.signal.aborted) {
          onUploadProgress?.(null);
        }
      }
    }, [clearUploadProgressTimers, execCommand, finishUploadProgress, onUploadProgress, scheduleUploadProgress]);

    const pickMedia = async () => {
      if (isPickingRef.current) return;
      isPickingRef.current = true;
      try {
        execCommand('blur');
        if (Platform.OS !== 'web') {
          const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!permission.granted) {
            showAppAlert('Hata', 'Medya arşivine erişim izni gerekli.');
            return;
          }
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images', 'videos'],
          allowsEditing: false,
          quality: 1,
          base64: true,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          uploadMediaAsset(result.assets[0]);
        }
      } catch (e: any) {
        console.error('pickMedia error:', e);
        showAppAlert('Hata', 'Medya seçici açılamadı. Hata: ' + e.message + '\nLütfen Expo Go uygulamasını tamamen kapatıp tekrar açın.');
      } finally {
        isPickingRef.current = false;
      }
    };

    const pickDocument = async () => {
      if (isPickingRef.current) return;
      isPickingRef.current = true;
      try {
        execCommand('blur');
        const result = await DocumentPicker.getDocumentAsync({
          type: '*/*',
          copyToCacheDirectory: true,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          uploadDocumentAsset(result.assets[0]);
        }
      } catch (e: any) {
        console.error('pickDocument error:', e);
        showAppAlert('Hata', 'Belge seçici açılamadı. Hata: ' + e.message + '\nLütfen Expo Go uygulamasını tamamen kapatıp tekrar açın.');
      } finally {
        isPickingRef.current = false;
      }
    };

    useImperativeHandle(ref, () => ({
      focus: () => execCommand('focus'),
      blur: () => execCommand('blur'),
      insertLink: (text: string, url: string) => {
        execCommand('insertLink', JSON.stringify({ text, url }));
      },
      getContent: () =>
        new Promise<string>((resolve) => {
          if (!isReady || !webViewRef.current) {
            resolve(contentRef.current);
            return;
          }

          if (pendingContentRequestRef.current) {
            clearTimeout(pendingContentRequestRef.current.timeout);
            pendingContentRequestRef.current.resolve(contentRef.current);
            pendingContentRequestRef.current = null;
          }

          const timeout = setTimeout(() => {
            if (!pendingContentRequestRef.current) return;
            pendingContentRequestRef.current.resolve(contentRef.current);
            pendingContentRequestRef.current = null;
          }, 450);

          pendingContentRequestRef.current = { resolve, timeout };
          execCommand('getContent', undefined, true);
        }),
      setContent: (html: string) => {
        execCommand('setContent', renderLatexInHtml(html));
      },
      setTitle: (title: string) => {
        titleRef.current = title;
        webViewRef.current?.injectJavaScript(`
          var titleEl = document.getElementById('note-title');
          if (titleEl) titleEl.value = ${JSON.stringify(title)};
          true;
        `);
      },
    }));

    useEffect(() => {
      if (!isReady) {
        return;
      }

      if (initialContent !== undefined) {
        const normalizedContent = renderLatexInHtml(initialContent);
        if (normalizedContent !== contentRef.current) {
          contentRef.current = normalizedContent;
          execCommand('setContent', normalizedContent);
        }
      }

      if (initialTitle !== undefined && initialTitle !== titleRef.current) {
        titleRef.current = initialTitle;
        webViewRef.current?.injectJavaScript(`
          var titleEl = document.getElementById('note-title');
          if (titleEl) titleEl.value = ${JSON.stringify(initialTitle)};
          true;
        `);
      }

      if (placeholder) {
        execCommand('setPlaceholder', placeholder);
      }
    }, [execCommand, initialContent, initialTitle, isReady, placeholder]);

    useEffect(() => {
      const uploadControllers = uploadControllersRef.current;
      const uploadProgressTimers = uploadProgressTimersRef.current;
      return () => {
        if (blurTimeoutRef.current) {
          clearTimeout(blurTimeoutRef.current);
        }
        if (sheetTimerRef.current) {
          clearTimeout(sheetTimerRef.current);
        }
        if (pendingContentRequestRef.current) {
          clearTimeout(pendingContentRequestRef.current.timeout);
          pendingContentRequestRef.current.resolve(contentRef.current);
          pendingContentRequestRef.current = null;
        }
        uploadControllers.forEach((controller) => controller.abort());
        uploadControllers.clear();
        uploadProgressTimers.forEach((timers) => {
          timers.forEach((timer) => clearTimeout(timer));
        });
        uploadProgressTimers.clear();
      };
    }, []);

    const handleMessage = useCallback(
      (event: any) => {
        try {
          const data = JSON.parse(event.nativeEvent.data);

          switch (data.type) {
            case 'contentChange':
              contentRef.current = data.content;
              onChange?.(data.content);
              break;
            case 'titleChange':
              titleRef.current = data.title;
              onTitleChange?.(data.title);
              break;
            case 'activeStyles':
              setActiveStyles(data.styles);
              if (typeof data.textColor === 'string' && data.textColor) {
                setActiveTextColor(data.textColor);
              }
              break;
            case 'focus':
              if (blurTimeoutRef.current) {
                clearTimeout(blurTimeoutRef.current);
              }
              setIsFocused(true);
              onFocus?.();
              break;
            case 'blur':
              blurTimeoutRef.current = setTimeout(() => {
                setIsFocused(false);
              }, 120);
              onBlur?.();
              break;
            case 'ready':
              setIsReady(true);
              break;
            case 'getContent':
              contentRef.current = data.content;
              if (pendingContentRequestRef.current) {
                clearTimeout(pendingContentRequestRef.current.timeout);
                pendingContentRequestRef.current.resolve(data.content);
                pendingContentRequestRef.current = null;
              }
              break;
            case 'media':
              if (data.mediaType === 'file') {
                setPreviewDocument({ url: data.url, title: data.title, isPdf: data.isPdf });
              }
              break;
            case 'fileMenu':
              if (data.url) {
                dismissEditorKeyboard();
                closeSheets();
                setFileActionTarget({
                  url: data.url,
                  title: data.title,
                  size: 'medium',
                  isPdf: Boolean(data.isPdf),
                });
              }
              break;
            case 'editFormula': {
              const parsedFormula = parseFormulaLatex(String(data.tex || ''));
              if (!parsedFormula) break;
              closeSheets();
              Keyboard.dismiss();
              setFormulaDraft({ ...parsedFormula, replaceSelected: true });
              setFormulaSheetVisible(true);
              break;
            }
            case 'cancelUpload':
              if (data.id) {
                const controller = uploadControllersRef.current.get(data.id);
                if (controller) {
                  controller.abort();
                  uploadControllersRef.current.delete(data.id);
                }
                clearUploadProgressTimers(data.id);
                onUploadProgress?.(null);
              }
              break;
            case 'haptic':
              if (Platform.OS !== 'web') {
                if (data.style === 'success') {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } else {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }
              break;
          }
        } catch (e) {
          console.error('Editor message parse error:', e);
        }
      },
      [clearUploadProgressTimers, closeSheets, dismissEditorKeyboard, onChange, onFocus, onBlur, onTitleChange, onUploadProgress]
    );

    const attachmentActions: ActionItem[] = [
      {
        id: 'media',
        label: t('editor.addPhotoVideo'),
        icon: <ImageIcon size={22} color={colors.text} />,
        onPress: () => pickMedia()
      },
      {
        id: 'file',
        label: t('editor.addDocumentFile'),
        icon: <FileIcon size={22} color={colors.text} />,
        onPress: () => pickDocument()
      },
      {
        id: 'link',
        label: t('link.add'),
        icon: <Link2 size={22} color={colors.text} />,
        onPress: openLinkSheet
      }
    ];

    const moreActions: ActionItem[] = [
      {
        id: 'undo',
        label: t('common.undo'),
        icon: <Undo size={22} color={colors.text} />,
        onPress: () => execCommand('undo')
      },
      {
        id: 'redo',
        label: t('editor.redo'),
        icon: <Redo size={22} color={colors.text} />,
        onPress: () => execCommand('redo')
      },
      {
        id: 'clear',
        label: t('editor.clearFormatting'),
        icon: <Eraser size={22} color="#FF453A" />,
        color: '#FF453A',
        destructive: true,
        onPress: () => execCommand('removeFormat')
      }
    ];

    const toolbar = (
      <KeyboardToolbar
        onFormatAa={openFormatSheet}
        onCheckList={() => execCommand('checkList')}
        onTable={() => execCommand('insertTable')}
        onAttachment={openAttachmentSheet}
        onDrawing={() => execCommand('insertDrawing')}
        onMore={openMoreSheet}
        onLatexSnippet={insertRenderedLatex}
        onApplyPower={applyLatexPower}
        onOpenFormula={openFormulaSheet}
        activeStyles={activeStyles}
      />
    );

    return (
      <View style={[styles.container, { backgroundColor: colors.background }, style]}>
        <WebView
          ref={webViewRef}
          source={webviewSource}
          onMessage={handleMessage}
          style={[styles.webview, { backgroundColor: colors.background }]}
          originWhitelist={['*']}
          scrollEnabled={true}
          keyboardDisplayRequiresUserAction={false}
          hideKeyboardAccessoryView={Platform.OS === 'ios'}
          automaticallyAdjustContentInsets={false}
          bounces={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsInlineMediaPlayback={true}
          startInLoadingState={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          overScrollMode="never"
          contentMode="mobile"
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
          allowFileAccessFromFileURLs={true}
          allowingReadAccessToURL="file://"
          textInteractionEnabled={true}
        />

        {isFocused && (
          <View style={styles.toolbarContainer}>
            {toolbar}
          </View>
        )}

        <FormatBottomSheet
          ref={formatSheetRef}
          onFormat={(cmd, val) => {
            if (cmd === 'foreColor' && val) {
              setActiveTextColor(val);
            }
            execCommand(cmd, val, true);
          }}
          activeStyles={activeStyles}
          activeTextColor={activeTextColor}
        />

        <ActionBottomSheet
          ref={attachmentSheetRef}
          title={t('editor.attachments')}
          actions={attachmentActions}
        />

        <ActionBottomSheet
          ref={moreSheetRef}
          title={t('editor.moreOptions')}
          actions={moreActions}
        />

        <LinkBottomSheet
          ref={linkSheetRef}
          onInsert={(text, url) => execCommand('insertLink', JSON.stringify({ text, url }), true)}
        />

        <DocumentViewer
          visible={!!previewDocument}
          url={previewDocument?.url || null}
          title={previewDocument?.title}
          isPdf={previewDocument?.isPdf}
          onClose={() => setPreviewDocument(null)}
        />

        <PdfActionSheet
          visible={!!fileActionTarget}
          target={fileActionTarget}
          keepKeyboardDismissed
          onClose={() => setFileActionTarget(null)}
          onOpen={(target) => {
            const selectedTarget = target as PdfActionTarget & { isPdf?: boolean };
            setPreviewDocument({
              url: selectedTarget.url,
              title: selectedTarget.title,
              isPdf: selectedTarget.isPdf ?? true,
            });
          }}
        />

        <FormulaInputSheet
          visible={formulaSheetVisible}
          mode={formulaDraft.mode}
          initialValues={formulaDraft.values}
          submitLabel={formulaDraft.replaceSelected ? t('common.save') : t('settings.add')}
          onClose={closeFormulaSheet}
          onSubmit={handleFormulaSubmit}
        />
      </View>
    );
  }
);

RichTextEditor.displayName = 'RichTextEditor';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000000',
  },
  toolbarContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
});
