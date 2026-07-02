import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="tr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <meta name="author" content="Çetele" />
        <meta name="theme-color" content="#000000" />
        <meta name="color-scheme" content="dark light" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Çetele" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />

        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{
          __html: `
          html,
          body,
          #root {
            margin: 0;
            min-height: 100%;
            background-color: #000000;
            color: #FFFFFF;
          }
          html {
            overscroll-behavior: none;
            -webkit-text-size-adjust: 100%;
          }
          body {
            min-height: 100dvh;
            scrollbar-gutter: stable;
            overflow-x: hidden;
          }
          ::-webkit-scrollbar {
            width: 12px;
            height: 12px;
          }
          ::-webkit-scrollbar-track {
            background: #000000;
          }
          ::-webkit-scrollbar-thumb {
            background: #2C2C2E;
            border-radius: 6px;
            border: 3px solid #000000;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: #3A3A3C;
          }
          ::-webkit-scrollbar-corner {
            background: #000000;
          }
          
          *:focus {
            outline: none;
          }
        ` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
