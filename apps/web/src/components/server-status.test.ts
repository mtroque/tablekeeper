import { readFileSync } from 'node:fs';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ServerStatus, ServerStatusLine } from './server-status';

const render = (online: boolean) =>
  renderToStaticMarkup(createElement(ServerStatusLine, { online }));

describe('ServerStatusLine', () => {
  it('says so while the browser is offline', () => {
    const html = render(false);
    expect(html).toContain('data-testid="status-offline"');
    expect(html).toContain(
      'You&#x27;re offline. Scoring still works; saving and rules need a connection.',
    );
  });

  it('shows nothing while online, and never a waking line', () => {
    expect(render(true)).toBe('');
    expect(renderToStaticMarkup(createElement(ServerStatus))).toBe('');
  });

  it("doesn't call the API on load", () => {
    const source = readFileSync(new URL('./server-status.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/health|api\(|Waking/);
  });
});
