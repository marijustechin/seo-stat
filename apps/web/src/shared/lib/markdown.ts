import { Fragment, createElement as h, type ReactNode } from 'react';

/**
 * Minimal, dependency-free Markdown renderer that returns React elements
 * (built with createElement, so it is JSX-free and easy to test). It never uses
 * dangerouslySetInnerHTML, so raw HTML in the source is rendered as escaped
 * text, and links are limited to http/https.
 */

const SAFE_LINK = /^(https?:)\/\//i;

function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${index}`;
    index += 1;
    if (token.startsWith('`')) {
      nodes.push(h('code', { key }, token.slice(1, -1)));
    } else if (token.startsWith('[')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const label = linkMatch?.[1] ?? token;
      const href = linkMatch?.[2]?.trim() ?? '';
      if (SAFE_LINK.test(href)) {
        nodes.push(
          h('a', { key, href, target: '_blank', rel: 'noreferrer noopener' }, label),
        );
      } else {
        nodes.push(h('span', { key }, `${label} (${href})`));
      }
    } else if (token.startsWith('**')) {
      nodes.push(h('strong', { key }, token.slice(2, -2)));
    } else {
      nodes.push(h('em', { key }, token.slice(1, -1)));
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export function renderMarkdown(markdown: string): ReactNode {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
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
      blocks.push(h('pre', { key: `b-${key++}` }, h('code', null, code.join('\n'))));
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = Math.min(heading[1]?.length ?? 1, 6);
      blocks.push(h(`h${level}`, { key: `b-${key++}` }, inline(heading[2] ?? '', `h-${key}`)));
      i += 1;
      continue;
    }
    if (line.startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && (lines[i] ?? '').startsWith('>')) {
        quote.push((lines[i] ?? '').replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push(h('blockquote', { key: `b-${key++}` }, inline(quote.join(' '), `q-${key}`)));
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^\s*[-*]\s+/, ''));
        i += 1;
      }
      blocks.push(
        h(
          'ul',
          { key: `b-${key++}` },
          items.map((item, itemIndex) => h('li', { key: itemIndex }, inline(item, `ul-${key}-${itemIndex}`))),
        ),
      );
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^\s*\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push(
        h(
          'ol',
          { key: `b-${key++}` },
          items.map((item, itemIndex) => h('li', { key: itemIndex }, inline(item, `ol-${key}-${itemIndex}`))),
        ),
      );
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
    blocks.push(h('p', { key: `b-${key++}` }, inline(paragraph.join(' '), `p-${key}`)));
  }
  return h(Fragment, null, ...blocks);
}
