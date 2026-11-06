import { describe, expect, it } from 'vitest';
import { formatDecimalInput, parseDecimal } from './decimal';

describe('parseDecimal', () => {
  it('lit la virgule et le point', () => {
    expect(parseDecimal('372,4')).toBe(372.4);
    expect(parseDecimal('372.4')).toBe(372.4);
    expect(parseDecimal('1 234,56')).toBe(1234.56);
    expect(parseDecimal('1 234,5')).toBe(1234.5);
  });

  it('refuse ce qui n’est pas un nombre', () => {
    expect(parseDecimal('')).toBeNaN();
    expect(parseDecimal('abc')).toBeNaN();
    expect(parseDecimal('1,2,3')).toBeNaN();
  });
});

describe('formatDecimalInput', () => {
  it('écrit avec une virgule', () => {
    expect(formatDecimalInput(744.8)).toBe('744,80');
    expect(formatDecimalInput(Number.NaN)).toBe('');
  });
});
