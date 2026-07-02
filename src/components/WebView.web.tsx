import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet } from 'react-native';

const WebViewComponent = (props: any, ref: any) => {
  const { source, style, onMessage } = props;
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useImperativeHandle(ref, () => ({
    injectJavaScript: (js: string) => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage({ type: 'EVAL_JS', js }, '*');
      }
    },
    postMessage: (msg: string) => {
       if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(msg, '*');
      }
    }
  }));

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {

      if (!event.data || event.data.source === 'react-devtools-bridge' || event.data.type === 'EVAL_JS') return;

      if (onMessage) {
        onMessage({
          nativeEvent: {
            data: typeof event.data === 'string' ? event.data : JSON.stringify(event.data)
          }
        });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onMessage]);

  let htmlContent = '';
  if (source?.html) {
    const injectionScript = `
      <script>
        window.addEventListener('message', function(e) {
          if (e.data && e.data.type === 'EVAL_JS') {
            try { eval(e.data.js); } catch(err) { console.error('EVAL ERROR', err); }
          }
        });
        window.ReactNativeWebView = {
          postMessage: function(msg) {
            window.parent.postMessage(msg, '*');
          }
        };
      </script>
    `;
    if (source.html.includes('</head>')) {
      htmlContent = source.html.replace('</head>', `${injectionScript}</head>`);
    } else {
      htmlContent = injectionScript + source.html;
    }
  }

  return (
    <View style={[styles.container, style]}>
      <iframe
        ref={iframeRef}
        src={source?.uri}
        srcDoc={htmlContent || undefined}
        style={{ width: '100%', height: '100%', border: 'none', background: 'transparent' }}
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        onLoad={() => {
          if (props.onLoadEnd) props.onLoadEnd();
        }}
      />
    </View>
  );
};

export const WebView = forwardRef(WebViewComponent);
WebView.displayName = 'WebView';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
});
