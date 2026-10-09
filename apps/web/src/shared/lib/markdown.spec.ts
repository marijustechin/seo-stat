import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown (safe preview)', () => {
  it('renders headings, lists, and emphasis', () => {
    const html = renderToStaticMarkup(renderMarkdown('# Title\n\n- one\n- two\n\n**bold** and *italic*'));
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<li>one</li>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  it('escapes raw HTML instead of executing it', () => {
    const html = renderToStaticMarkup(renderMarkdown('<script>alert(1)</script>\n\nHello'));
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('rejects unsafe link schemes', () => {
    const html = renderToStaticMarkup(renderMarkdown('[click](javascript:alert(1))'));
    expect(html).not.toContain('<a');
    expect(html).toContain('click');
  });

  it('renders safe http links', () => {
    const html = renderToStaticMarkup(renderMarkdown('[site](https://example.com)'));
    expect(html).toContain('<a');
    expect(html).toContain('https://example.com');
  });
});
