/**
 * Minimal, dependency-free Markdown-to-HTML converter for article export.
 *
 * It mirrors the supported subset of the web preview renderer
 * (`apps/web/src/shared/lib/markdown.ts`): headings, blockquotes, unordered and
 * ordered lists, fenced code blocks, paragraphs, inline code/bold/italic, and
 * links. All source text is HTML-escaped, so raw HTML in the Markdown is emitted
 * as escaped text (never markup), and links are limited to http/https.
 */

const SAFE_LINK = /^https?:\/\//i;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape text for an attribute value (href). */
function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

function inlineToHtml(text: string): string {
  const pattern = /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) result += escapeHtml(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith('`')) {
      result += `<code>${escapeHtml(token.slice(1, -1))}</code>`;
    } else if (token.startsWith('[')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const label = linkMatch?.[1] ?? token;
      const href = linkMatch?.[2]?.trim() ?? '';
      if (SAFE_LINK.test(href)) {
        result += `<a href="${escapeAttribute(href)}" rel="noreferrer noopener">${escapeHtml(label)}</a>`;
      } else {
        result += escapeHtml(`${label} (${href})`);
      }
    } else if (token.startsWith('**')) {
      result += `<strong>${escapeHtml(token.slice(2, -2))}</strong>`;
    } else {
      result += `<em>${escapeHtml(token.slice(1, -1))}</em>`;
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) result += escapeHtml(text.slice(lastIndex));
  return result;
}

export function renderMarkdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (line.trim() === '') {
      i += 1;
      continue;
    }
    if (line.trimStart().startsWith('```')) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? '').trimStart().startsWith('```')) {
        code.push(lines[i] ?? '');
        i += 1;
      }
      i += 1;
      blocks.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = Math.min(heading[1]?.length ?? 1, 6);
      blocks.push(`<h${level}>${inlineToHtml(heading[2] ?? '')}</h${level}>`);
      i += 1;
      continue;
    }
    if (line.startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && (lines[i] ?? '').startsWith('>')) {
        quote.push((lines[i] ?? '').replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push(`<blockquote>${inlineToHtml(quote.join(' '))}</blockquote>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^\s*[-*]\s+/, ''));
        i += 1;
      }
      blocks.push(`<ul>${items.map((item) => `<li>${inlineToHtml(item)}</li>`).join('')}</ul>`);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^\s*\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push(`<ol>${items.map((item) => `<li>${inlineToHtml(item)}</li>`).join('')}</ol>`);
      continue;
    }
    const paragraph: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? '').trim() !== '' &&
      !/^(#{1,6})\s+/.test(lines[i] ?? '') &&
      !(lines[i] ?? '').startsWith('>') &&
      !/^\s*[-*]\s+/.test(lines[i] ?? '') &&
      !/^\s*\d+\.\s+/.test(lines[i] ?? '') &&
      !(lines[i] ?? '').trimStart().startsWith('```')
    ) {
      paragraph.push(lines[i] ?? '');
      i += 1;
    }
    blocks.push(`<p>${inlineToHtml(paragraph.join(' '))}</p>`);
  }
  return blocks.join('\n');
}
