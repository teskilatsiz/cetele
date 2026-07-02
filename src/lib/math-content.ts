import katex from 'katex';

const TAG_SPLIT_RE = /(<[^>]+>)/g;

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(value: string) {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
}

function escapeAttr(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizeMathTokenTypography(markup: string) {
  return markup
    .replace(/<(?:mi|mn|mo)\b[^>]*>/gi, '<mtext>')
    .replace(/<\/(?:mi|mn|mo)>/gi, '</mtext>');
}

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  '=': '⁼',
  '(': '⁽',
  ')': '⁾',
};

const SUBSCRIPT_DIGITS: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
  '+': '₊',
  '-': '₋',
  '=': '₌',
  '(': '₍',
  ')': '₎',
};

function mapScript(value: string, map: Record<string, string>) {
  return value
    .split('')
    .map((char) => map[char] || char)
    .join('');
}

function splitTopLevelMathChildren(value: string) {
  const withoutAnnotation = value.replace(/<annotation\b[\s\S]*?<\/annotation>/gi, '');
  const childMatches = Array.from(withoutAnnotation.matchAll(/<([a-z][\w:-]*)\b[^>]*>[\s\S]*?<\/\1>/gi));
  if (childMatches.length >= 2) {
    return childMatches.slice(0, 2).map((match) => match[0]);
  }
  return [];
}

function mathMlToPlainText(mathHtml: string): string {
  if (!mathHtml) return '';

  const cleaned = mathHtml.replace(/<annotation\b[\s\S]*?<\/annotation>/gi, '');

  const powerMatch = cleaned.match(/<msup\b[^>]*>([\s\S]*?)<\/msup>/i);
  if (powerMatch) {
    const [base, exponent] = splitTopLevelMathChildren(powerMatch[1]);
    if (base && exponent) {
      return `${mathMlToPlainText(base)}${mapScript(mathMlToPlainText(exponent), SUPERSCRIPT_DIGITS)}`;
    }
  }

  const subscriptMatch = cleaned.match(/<msub\b[^>]*>([\s\S]*?)<\/msub>/i);
  if (subscriptMatch) {
    const [base, subscript] = splitTopLevelMathChildren(subscriptMatch[1]);
    if (base && subscript) {
      return `${mathMlToPlainText(base)}${mapScript(mathMlToPlainText(subscript), SUBSCRIPT_DIGITS)}`;
    }
  }

  const fracMatch = cleaned.match(/<mfrac\b[^>]*>([\s\S]*?)<\/mfrac>/i);
  if (fracMatch) {
    const [top, bottom] = splitTopLevelMathChildren(fracMatch[1]);
    if (top && bottom) {
      return `${mathMlToPlainText(top)}⁄${mathMlToPlainText(bottom)}`;
    }
  }

  const sqrtMatch = cleaned.match(/<msqrt\b[^>]*>([\s\S]*?)<\/msqrt>/i);
  if (sqrtMatch) {
    return `√${mathMlToPlainText(sqrtMatch[1])}`;
  }

  return stripTags(cleaned)
    .replace(/\s+/g, '')
    .trim();
}

function findClosingDelimiter(source: string, delimiter: string, fromIndex: number) {
  let index = fromIndex;
  while (index < source.length) {
    const next = source.indexOf(delimiter, index);
    if (next === -1) return -1;
    if (next === 0 || source[next - 1] !== '\\') return next;
    index = next + delimiter.length;
  }
  return -1;
}

export function renderLatexMathHtml(source: string, displayMode = false) {
  const tex = decodeHtmlEntities(source).trim();
  if (!tex) return null;

  try {
    const math = normalizeMathTokenTypography(katex.renderToString(tex, {
      displayMode,
      output: 'mathml',
      throwOnError: false,
      strict: 'ignore',
      trust: false,
    }));

    const tag = displayMode ? 'div' : 'span';
    return `<${tag} class="${displayMode ? 'math-display' : 'math-inline'}" data-latex="${escapeAttr(tex)}" contenteditable="false">${math}</${tag}>`;
  } catch {
    return null;
  }
}

function renderFormula(source: string, displayMode: boolean) {
  return renderLatexMathHtml(source, displayMode);
}

export function latexToPlainText(source: string): string {
  let tex = decodeHtmlEntities(source).trim();
  if (!tex) return '';

  tex = tex
    .replace(/^\$\$?|\$\$?$/g, '')
    .replace(/^\\\(|\\\)$/g, '')
    .replace(/^\\\[|\\\]$/g, '')
    .trim();

  const sumMatch = tex.match(/^\\sum_\{([^{}]+)\}\^\{([^{}]+)\}\s*(.+)$/);
  if (sumMatch) {
    return `∑ ${latexToPlainText(sumMatch[3])} (${sumMatch[1]}→${sumMatch[2]})`;
  }

  const integralMatch = tex.match(/^\\int_\{([^{}]+)\}\^\{([^{}]+)\}\s*(.+?)\\,d\s*([^\s]+)$/);
  if (integralMatch) {
    return `∫ ${latexToPlainText(integralMatch[3])} d${integralMatch[4]} (${integralMatch[1]}→${integralMatch[2]})`;
  }

  const indexedRoot = tex.match(/^\\sqrt\[([^\]]+)\]\{([^{}]+)\}$/);
  if (indexedRoot) {
    return `${indexedRoot[1]}√${latexToPlainText(indexedRoot[2])}`;
  }

  const simplePower = tex.match(/^(.+?)\^\{?([^{}]+)\}?$/);
  if (simplePower) {
    return `${latexToPlainText(simplePower[1])}${mapScript(simplePower[2], SUPERSCRIPT_DIGITS)}`;
  }

  const simpleSubscript = tex.match(/^(.+?)_\{?([^{}]+)\}?$/);
  if (simpleSubscript) {
    return `${latexToPlainText(simpleSubscript[1])}${mapScript(simpleSubscript[2], SUBSCRIPT_DIGITS)}`;
  }

  tex = tex
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_match, top, bottom) => `${top}⁄${bottom}`)
    .replace(/\\sqrt\{([^{}]+)\}/g, (_match, value) => `√${value}`)
    .replace(/\\sum(?:_\{([^{}]+)\})?(?:\^\{([^{}]+)\})?/g, '∑')
    .replace(/\\int(?:_\{([^{}]+)\})?(?:\^\{([^{}]+)\})?/g, '∫')
    .replace(/\\pi/g, 'π')
    .replace(/\\infty/g, '∞')
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '·')
    .replace(/\\,/g, ' ')
    .replace(/[{}]/g, '')
    .replace(/\\/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return tex;
}

export function replaceRenderedLatexWithText(html: string) {
  if (!html) return '';

  return html
    .replace(
      /<[^>]*data-latex=(["'])(.*?)\1[^>]*>(?:\s*<span\b[^>]*>)?\s*(<math\b[\s\S]*?<\/math>)/gi,
      (_match, _quote, tex, math) => ` ${mathMlToPlainText(math) || latexToPlainText(tex)} `
    )
    .replace(/<math\b[\s\S]*?<\/math>/gi, (math) => ` ${mathMlToPlainText(math)} `)
    .replace(/<[^>]*data-latex=(["'])(.*?)\1[^>]*>/gi, (_match, _quote, tex) => ` ${latexToPlainText(tex)} `);
}

function processTextToken(token: string) {
  let output = '';
  let index = 0;

  while (index < token.length) {
    if (token.startsWith('$$', index)) {
      const end = findClosingDelimiter(token, '$$', index + 2);
      if (end !== -1) {
        const rendered = renderFormula(token.slice(index + 2, end), true);
        if (rendered) {
          output += rendered;
          index = end + 2;
          continue;
        }
      }
    }

    if (token.startsWith('\\[', index)) {
      const end = findClosingDelimiter(token, '\\]', index + 2);
      if (end !== -1) {
        const rendered = renderFormula(token.slice(index + 2, end), true);
        if (rendered) {
          output += rendered;
          index = end + 2;
          continue;
        }
      }
    }

    if (token.startsWith('\\(', index)) {
      const end = findClosingDelimiter(token, '\\)', index + 2);
      if (end !== -1) {
        const rendered = renderFormula(token.slice(index + 2, end), false);
        if (rendered) {
          output += rendered;
          index = end + 2;
          continue;
        }
      }
    }

    if (token[index] === '$' && token[index + 1] !== '$') {
      const end = findClosingDelimiter(token, '$', index + 1);
      if (end !== -1 && token[end + 1] !== '$') {
        const expression = token.slice(index + 1, end);
        if (!expression.includes('\n')) {
          const rendered = renderFormula(expression, false);
          if (rendered) {
            output += rendered;
            index = end + 1;
            continue;
          }
        }
      }
    }

    output += token[index];
    index += 1;
  }

  return output;
}

export function renderLatexInHtml(html: string) {
  if (!html) return '';

  const normalizedHtml = normalizeMathTokenTypography(html);

  return normalizedHtml
    .split(TAG_SPLIT_RE)
    .map((token) => {
      if (!token || token.startsWith('<')) return token;
      return processTextToken(token);
    })
    .join('');
}
