import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { commitCounterValue, Counter, liveCounterValue, sanitizeCounterInput } from './counter';

const render = (props: { value: number; min?: number; uncertain?: boolean }) =>
  renderToStaticMarkup(
    createElement(Counter, {
      label: 'Forest',
      onChange: () => undefined,
      ...props,
    }),
  );

describe('sanitizeCounterInput', () => {
  it('keeps digits only, so "abc" types nothing', () => {
    expect(sanitizeCounterInput('abc', 0)).toBe('');
    expect(sanitizeCounterInput('3a7', 0)).toBe('37');
    expect(sanitizeCounterInput('1.5e2', 0)).toBe('152');
  });

  it('accepts a leading minus only when min allows negatives', () => {
    expect(sanitizeCounterInput('-5', 0)).toBe('5');
    expect(sanitizeCounterInput('-5', -10)).toBe('-5');
    expect(sanitizeCounterInput('-', -10)).toBe('-');
    expect(sanitizeCounterInput('5-', -10)).toBe('5');
  });
});

describe('liveCounterValue', () => {
  it('applies a number in range at once', () => {
    expect(liveCounterValue('3', 0, 999)).toBe(3);
    expect(liveCounterValue('37', 0, 999)).toBe(37);
    expect(liveCounterValue('037', 0, 999)).toBe(37);
  });

  it('clamps over max at once, since more digits only make it larger', () => {
    expect(liveCounterValue('25', 0, 20)).toBe(20);
    expect(liveCounterValue('-50', -10, 10)).toBe(-10);
  });

  it('waits on empty, a lone minus, or a number more digits could bring into range', () => {
    expect(liveCounterValue('', 0, 999)).toBeNull();
    expect(liveCounterValue('-', -10, 10)).toBeNull();
    expect(liveCounterValue('1', 5, 99)).toBeNull();
  });
});

describe('commitCounterValue', () => {
  it('sets a typed number', () => {
    expect(commitCounterValue('37', 4, 0, 999)).toBe(37);
  });

  it('restores the value from before editing when empty or invalid', () => {
    expect(commitCounterValue('', 4, 0, 999)).toBe(4);
    expect(commitCounterValue('-', 4, -10, 10)).toBe(4);
  });

  it('clamps to min and max', () => {
    expect(commitCounterValue('1000', 4, 0, 999)).toBe(999);
    expect(commitCounterValue('1', 4, 5, 99)).toBe(5);
    expect(commitCounterValue('-3', 4, -2, 10)).toBe(-2);
  });
});

describe('Counter', () => {
  it('shows the value in a labeled number field between − and +', () => {
    const html = render({ value: 12 });
    const id = /<label for="([^"]+)"[^>]*>Forest<\/label>/.exec(html)?.[1];
    expect(id).toBeDefined();
    expect(html).toContain(`id="${id ?? ''}"`);
    expect(html).toMatch(/<input[^>]*inputMode="numeric"[^>]*value="12"/);
    expect(html).toContain('pattern="[0-9]*"');
    expect(html).toContain('aria-label="Decrease Forest"');
    expect(html).toContain('aria-label="Increase Forest"');
    expect(html).not.toContain('Hold to type');
  });

  it('disables − at min and + at max', () => {
    expect(render({ value: 0 })).toMatch(/aria-label="Decrease Forest" disabled=""/);
    expect(
      renderToStaticMarkup(
        createElement(Counter, { label: 'Chits', value: 3, max: 3, onChange: () => undefined }),
      ),
    ).toMatch(/aria-label="Increase Chits" disabled=""/);
  });

  it('keeps the uncertain outline on the field', () => {
    expect(render({ value: 2, uncertain: true })).toMatch(/<input[^>]*outline-dashed/);
    expect(render({ value: 2 })).not.toContain('outline-dashed');
  });

  it('lets the keyboard offer a minus only when min allows it', () => {
    expect(render({ value: 0, min: -5 })).toContain('pattern="-?[0-9]*"');
  });
});
