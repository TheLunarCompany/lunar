// src/validator.test.ts
import { validateOutput } from './validator';

describe('validateOutput', () => {
  it('passes exact match', () => {
    expect(validateOutput('foo', { mode: 'exact', value: 'foo' })).toEqual({ success: true });
  });

  it('fails exact mismatch', () => {
    const res = validateOutput('foo', { mode: 'exact', value: 'bar' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.errors[0]).toMatch(/Exact mismatch/);
    }
  });

  it('passes contains', () => {
    expect(validateOutput('hello world', { mode: 'contains', value: 'world' })).toEqual({
      success: true,
    });
  });

  it('fails contains', () => {
    const res = validateOutput('hello', { mode: 'contains', value: 'world' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.errors[0]).toMatch(/Missing substring/);
    }
  });

  it('passes regex', () => {
    expect(validateOutput('abc123', { mode: 'regex', value: '\\d+' })).toEqual({ success: true });
  });

  it('fails regex', () => {
    const res = validateOutput('abc', { mode: 'regex', value: '\\d+' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.errors[0]).toMatch(/did not match/);
    }
  });

  it('passes json-schema', () => {
    const schema = {
      type: 'object',
      properties: { a: { type: 'number' } },
      required: ['a'],
    };
    const res = validateOutput(JSON.stringify({ a: 1 }), {
      mode: 'json-schema',
      value: schema,
    });
    expect(res).toEqual({ success: true });
  });

  it('fails invalid JSON', () => {
    const res = validateOutput('not json', {
      mode: 'json-schema',
      value: {},
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.errors[0]).toMatch(/Invalid JSON/);
    }
  });

  it('fails schema validation', () => {
    const schema = {
      type: 'object',
      properties: { a: { type: 'number' } },
      required: ['a'],
    };
    const res = validateOutput(JSON.stringify({ b: 2 }), {
      mode: 'json-schema',
      value: schema,
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.errors[0]).toMatch(/Schema errors/);
    }
  });
});
