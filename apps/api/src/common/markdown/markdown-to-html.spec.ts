import { describe, expect, it } from 'vitest';
import { escapeHtml, renderMarkdownToHtml } from './markdown-to-html.js';

describe('markdown to safe HTML', () => {
  it('renders headings, emphasis, lists, and paragraphs', () => {
    const html = renderMarkdownToHtml('# Heading\n\nHello **bold** and *italic*.\n\n- one\n- two\n\n1. first');
    expect(html).toContain('<h1>Heading</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<ul><li>one</li><li>two</li></ul>');
    expect(html).toContain('<ol><li>first</li></ol>');
  });

  it('escapes raw HTML so it is emitted as text, never markup', () => {
    const html = renderMarkdownToHtml('<script>alert(1)</script> and <img src=x onerror=alert(2)>');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img');
  });

  it('allows only safe http/https links and refuses javascript: URLs', () => {
    const safe = renderMarkdownToHtml('[example](https://example.com)');
    expect(safe).toContain('<a href="https://example.com" rel="noreferrer noopener">example</a>');

    const unsafe = renderMarkdownToHtml('[click](javascript:alert(1))');
    expect(unsafe).not.toContain('<a ');
    expect(unsafe).toContain('click (javascript:alert(1))');
  });

  it('escapes fenced code and inline code', () => {
    const html = renderMarkdownToHtml('```\n<b>code</b>\n```\n\nUse `a < b`.');
    expect(html).toContain('<pre><code>&lt;b&gt;code&lt;/b&gt;</code></pre>');
    expect(html).toContain('<code>a &lt; b</code>');
  });

  it('escapes attribute-breaking characters', () => {
    expect(escapeHtml('"\'&<>')).toBe('&quot;&#39;&amp;&lt;&gt;');
  });
});
