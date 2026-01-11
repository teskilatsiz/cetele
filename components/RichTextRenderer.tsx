import { Text, View, StyleSheet, TouchableOpacity, Platform, Linking } from 'react-native';
import { Link } from 'lucide-react-native';

interface RichTextRendererProps {
  content: string;
  style?: any;
  previewMode?: boolean;
}

export function RichTextRenderer({ content, style, previewMode = false }: RichTextRendererProps) {
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

  const parseHtmlToMarkdown = (html: string): string => {
    let markdown = html;

    markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n');
    markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n');
    markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n');

    markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
    markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');

    markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
    markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');

    markdown = markdown.replace(/<u[^>]*>(.*?)<\/u>/gi, '_$1_');

    markdown = markdown.replace(/<strike[^>]*>(.*?)<\/strike>/gi, '~~$1~~');
    markdown = markdown.replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~');
    markdown = markdown.replace(/<del[^>]*>(.*?)<\/del>/gi, '~~$1~~');

    markdown = markdown.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');

    markdown = markdown.replace(/<ul[^>]*>(.*?)<\/ul>/gis, (match, content) => {
      return content.replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n');
    });

    markdown = markdown.replace(/<ol[^>]*>(.*?)<\/ol>/gis, (match, content) => {
      let counter = 1;
      return content.replace(/<li[^>]*>(.*?)<\/li>/gi, (m: string, item: string) => {
        return `${counter++}. ${item}\n`;
      });
    });

    markdown = markdown.replace(/<br\s*\/?>/gi, '\n');
    markdown = markdown.replace(/<\/p>/gi, '\n\n');
    markdown = markdown.replace(/<p[^>]*>/gi, '');
    markdown = markdown.replace(/<div[^>]*>/gi, '');
    markdown = markdown.replace(/<\/div>/gi, '\n');

    markdown = markdown.replace(/<[^>]+>/g, '');

    markdown = markdown.replace(/&nbsp;/g, ' ');
    markdown = markdown.replace(/&amp;/g, '&');
    markdown = markdown.replace(/&lt;/g, '<');
    markdown = markdown.replace(/&gt;/g, '>');
    markdown = markdown.replace(/&quot;/g, '"');
    markdown = markdown.replace(/&#39;/g, "'");

    markdown = markdown.replace(/\n{3,}/g, '\n\n');

    return markdown.trim();
  };

  const renderMarkdown = (text: string) => {
    const markdownText = parseHtmlToMarkdown(text);

    const parts: React.ReactElement[] = [];
    const lines = markdownText.split('\n');
    let keyIndex = 0;
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      if (line.trim() === '') {
        parts.push(<View key={`space-${keyIndex++}`} style={styles.lineBreak} />);
        continue;
      }

      if (line.match(/^```([\s\S]*?)$/)) {
        let codeContent = '';
        i++;
        while (i < lines.length && !lines[i].match(/^```$/)) {
          codeContent += lines[i] + '\n';
          i++;
        }
        parts.push(
          <View key={`code-${keyIndex++}`} style={styles.codeBlock}>
            <Text style={styles.codeText}>{codeContent.trim()}</Text>
          </View>
        );
        continue;
      }

      if (line.match(/^# (.+)/)) {
        const heading = line.replace(/^# /, '');
        parts.push(
          <Text key={`h1-${keyIndex++}`} style={[styles.heading1, previewMode && styles.previewText]}>
            {renderInlineMarkdown(heading, previewMode)}
          </Text>
        );
        continue;
      }

      if (line.match(/^## (.+)/)) {
        const heading = line.replace(/^## /, '');
        parts.push(
          <Text key={`h2-${keyIndex++}`} style={[styles.heading2, previewMode && styles.previewText]}>
            {renderInlineMarkdown(heading, previewMode)}
          </Text>
        );
        continue;
      }

      if (line.match(/^### (.+)/)) {
        const heading = line.replace(/^### /, '');
        parts.push(
          <Text key={`h3-${keyIndex++}`} style={[styles.heading3, previewMode && styles.previewText]}>
            {renderInlineMarkdown(heading, previewMode)}
          </Text>
        );
        continue;
      }

      if (line.match(/^[•\-\*] (.+)/)) {
        const bulletText = line.replace(/^[•\-\*] /, '');
        parts.push(
          <View key={`bullet-${keyIndex++}`} style={styles.bulletContainer}>
            <Text style={[styles.bulletPoint, previewMode && styles.previewText]}>•</Text>
            <Text style={[styles.bulletText, previewMode && styles.previewText]}>
              {renderInlineMarkdown(bulletText, previewMode)}
            </Text>
          </View>
        );
        continue;
      }

      if (line.match(/^\d+\. (.+)/)) {
        const match = line.match(/^(\d+)\. (.+)/);
        if (match) {
          const number = match[1];
          const listText = match[2];
          parts.push(
            <View key={`list-${keyIndex++}`} style={styles.bulletContainer}>
              <Text style={[styles.listNumber, previewMode && styles.previewText]}>{number}.</Text>
              <Text style={[styles.bulletText, previewMode && styles.previewText]}>
                {renderInlineMarkdown(listText, previewMode)}
              </Text>
            </View>
          );
        }
        continue;
      }

      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const linkMatches = line.match(urlRegex);
      if (linkMatches && !previewMode) {
        const linkParts: React.ReactElement[] = [];
        let lastIndex = 0;
        let linkKeyIndex = 0;

        linkMatches.forEach((url) => {
          const urlIndex = line.indexOf(url, lastIndex);
          if (urlIndex > lastIndex) {
            linkParts.push(
              <Text key={`text-${linkKeyIndex++}`} style={[styles.content, previewMode && styles.previewText]}>
                {renderInlineMarkdown(line.substring(lastIndex, urlIndex), previewMode)}
              </Text>
            );
          }
          linkParts.push(
            <TouchableOpacity
              key={`link-${linkKeyIndex++}`}
              style={styles.inlineLink}
              onPress={() => handleLinkPress(url)}
              activeOpacity={0.7}>
              <Link size={14} color="#0A84FF" strokeWidth={2} />
              <Text style={styles.linkText} numberOfLines={1}>
                {url}
              </Text>
            </TouchableOpacity>
          );
          lastIndex = urlIndex + url.length;
        });

        if (lastIndex < line.length) {
          linkParts.push(
            <Text key={`text-${linkKeyIndex++}`} style={[styles.content, previewMode && styles.previewText]}>
              {renderInlineMarkdown(line.substring(lastIndex), previewMode)}
            </Text>
          );
        }

        parts.push(
          <View key={`line-${keyIndex++}`} style={styles.paragraph}>
            {linkParts}
          </View>
        );
      } else {
        parts.push(
          <Text key={`text-${keyIndex++}`} style={[styles.content, previewMode && styles.previewText]}>
            {renderInlineMarkdown(line, previewMode)}
          </Text>
        );
      }
    }

    return parts;
  };

  const renderInlineMarkdown = (text: string, isPreview: boolean = false) => {
    const parts: (string | React.ReactElement)[] = [];
    let keyIndex = 0;

    const patterns = [
      { regex: /\*\*(.+?)\*\*/g, type: 'bold' },
      { regex: /\*(.+?)\*/g, type: 'italic' },
      { regex: /_(.+?)_/g, type: 'underline' },
      { regex: /~~(.+?)~~/g, type: 'strikethrough' },
      { regex: /\[([^\]]+)\]\(([^)]+)\)/g, type: 'link' },
    ];

    const matches: Array<{
      type: string;
      start: number;
      end: number;
      content: string;
      url?: string;
      fullMatch: string;
    }> = [];

    patterns.forEach((pattern) => {
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      let match;
      while ((match = regex.exec(text)) !== null) {
        const overlaps = matches.some(
          (m) =>
            (match.index >= m.start && match.index < m.end) ||
            (match.index + match[0].length > m.start && match.index + match[0].length <= m.end) ||
            (match.index <= m.start && match.index + match[0].length >= m.end)
        );

        if (!overlaps) {
          if (pattern.type === 'link') {
            matches.push({
              type: 'link',
              start: match.index,
              end: match.index + match[0].length,
              content: match[1],
              url: match[2],
              fullMatch: match[0],
            });
          } else {
            matches.push({
              type: pattern.type,
              start: match.index,
              end: match.index + match[0].length,
              content: match[1],
              fullMatch: match[0],
            });
          }
        }
      }
    });

    matches.sort((a, b) => a.start - b.start);

    let lastIndex = 0;
    matches.forEach((match) => {
      if (match.start > lastIndex) {
        const plainText = text.substring(lastIndex, match.start);
        if (plainText) {
          parts.push(plainText);
        }
      }

      if (match.type === 'link' && match.url) {
        parts.push(
          <Text key={`inline-link-${keyIndex++}`} style={styles.inlineLinkText}>
            {match.content}
          </Text>
        );
      } else if (match.type === 'bold') {
        parts.push(
          <Text key={`bold-${keyIndex++}`} style={styles.bold}>
            {match.content}
          </Text>
        );
      } else if (match.type === 'italic') {
        parts.push(
          <Text key={`italic-${keyIndex++}`} style={styles.italic}>
            {match.content}
          </Text>
        );
      } else if (match.type === 'underline') {
        parts.push(
          <Text key={`underline-${keyIndex++}`} style={styles.underline}>
            {match.content}
          </Text>
        );
      } else if (match.type === 'strikethrough') {
        parts.push(
          <Text key={`strike-${keyIndex++}`} style={styles.strikethrough}>
            {match.content}
          </Text>
        );
      }

      lastIndex = match.end;
    });

    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex);
      if (remainingText) {
        parts.push(remainingText);
      }
    }

    return parts.length > 0 ? parts : text;
  };

  return <View style={style}>{renderMarkdown(content)}</View>;
}

const styles = StyleSheet.create({
  content: {
    fontSize: 17,
    color: '#EEEEEE',
    lineHeight: 28,
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  previewText: {
    fontSize: 15,
    color: '#AEAEB2',
    lineHeight: 22,
  },
  heading1: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    marginTop: 8,
    letterSpacing: -0.4,
  },
  heading2: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 10,
    marginTop: 8,
    letterSpacing: -0.3,
  },
  heading3: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    marginTop: 6,
    letterSpacing: -0.2,
  },
  bold: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  italic: {
    fontStyle: 'italic',
    color: '#EEEEEE',
  },
  underline: {
    textDecorationLine: 'underline',
    color: '#EEEEEE',
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    color: '#AEAEB2',
  },
  bulletContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 8,
  },
  bulletPoint: {
    fontSize: 17,
    color: '#EEEEEE',
    marginRight: 12,
    lineHeight: 28,
  },
  listNumber: {
    fontSize: 17,
    color: '#EEEEEE',
    marginRight: 12,
    lineHeight: 28,
    minWidth: 24,
  },
  bulletText: {
    fontSize: 17,
    color: '#EEEEEE',
    lineHeight: 28,
    flex: 1,
    letterSpacing: -0.2,
  },
  codeBlock: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  codeText: {
    fontSize: 14,
    color: '#00D9FF',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 22,
  },
  paragraph: {
    marginBottom: 8,
  },
  inlineLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(10, 132, 255, 0.3)',
  },
  linkText: {
    fontSize: 15,
    color: '#0A84FF',
    fontWeight: '600',
    flex: 1,
  },
  inlineLinkText: {
    color: '#0A84FF',
    textDecorationLine: 'underline',
  },
  lineBreak: {
    height: 8,
  },
});
