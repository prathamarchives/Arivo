/**
 * RUNTIME VALIDATION — typescript disappears at runtime; validation does not.
 * every ipc payload passes through a validator before touching a service.
 * combinators are pure and dependency-free: they run in main, preload, tests.
 */
import { ArivoError } from './errors.ts';

export class ValidationError extends ArivoError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_FAILED', message, details);
    this.name = 'ValidationError';
  }
}

export type Validator<T> = (input: unknown, path?: string) => T;

const fail = (path: string, expected: string, received: unknown): never => {
  const receivedType =
    received === null ? 'null' : Array.isArray(received) ? 'array' : typeof received;
  throw new ValidationError(`${path || 'input'}: expected ${expected}, received ${receivedType}`, {
    path,
    expected,
  });
};

export const v = {
  string(opts: { min?: number; max?: number; pattern?: RegExp } = {}): Validator<string> {
    const { min = 0, max = 100_000, pattern } = opts;
    return (input, path = '') => {
      if (typeof input !== 'string') fail(path, 'string', input);
      const s = input as string;
      if (s.length < min) throw new ValidationError(`${path || 'input'}: shorter than ${min}`, { path });
      if (s.length > max) throw new ValidationError(`${path || 'input'}: longer than ${max}`, { path });
      if (pattern && !pattern.test(s)) {
        throw new ValidationError(`${path || 'input'}: does not match the required shape`, { path });
      }
      return s;
    };
  },

  number(opts: { min?: number; max?: number; int?: boolean } = {}): Validator<number> {
    const { min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY, int = false } = opts;
    return (input, path = '') => {
      if (typeof input !== 'number' || !Number.isFinite(input)) fail(path, 'number', input);
      const n = input as number;
      if (int && !Number.isInteger(n)) {
        throw new ValidationError(`${path || 'input'}: expected an integer`, { path });
      }
      if (n < min || n > max) {
        throw new ValidationError(`${path || 'input'}: outside [${min}, ${max}]`, { path });
      }
      return n;
    };
  },

  boolean(): Validator<boolean> {
    return (input, path = '') => {
      if (typeof input !== 'boolean') fail(path, 'boolean', input);
      return input as boolean;
    };
  },

  literal<T extends string | number | boolean>(value: T): Validator<T> {
    return (input, path = '') => {
      if (input !== value) fail(path, `literal ${JSON.stringify(value)}`, input);
      return value;
    };
  },

  enum<T extends string>(...values: readonly [T, ...T[]]): Validator<T> {
    const set = new Set<string>(values);
    return (input, path = '') => {
      if (typeof input !== 'string' || !set.has(input)) {
        fail(path, `one of ${values.join(' | ')}`, input);
      }
      return input as T;
    };
  },

  array<T>(item: Validator<T>, opts: { min?: number; max?: number } = {}): Validator<T[]> {
    const { min = 0, max = 10_000 } = opts;
    return (input, path = '') => {
      if (!Array.isArray(input)) fail(path, 'array', input);
      const arr = input as unknown[];
      if (arr.length < min || arr.length > max) {
        throw new ValidationError(`${path || 'input'}: array length ${arr.length} outside [${min}, ${max}]`, {
          path,
        });
      }
      return arr.map((entry, i) => item(entry, `${path}[${i}]`));
    };
  },

  object<S extends Record<string, Validator<unknown>>>(
    shape: S,
  ): Validator<{ [K in keyof S]: S[K] extends Validator<infer T> ? T : never }> {
    return (input, path = '') => {
      if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        fail(path, 'object', input);
      }
      const obj = input as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const [key, validator] of Object.entries(shape)) {
        out[key] = validator(obj[key], path ? `${path}.${key}` : key);
      }
      return out as { [K in keyof S]: S[K] extends Validator<infer T> ? T : never };
    };
  },

  optional<T>(inner: Validator<T>): Validator<T | undefined> {
    return (input, path = '') => {
      if (input === undefined) return undefined;
      return inner(input, path);
    };
  },

  nullable<T>(inner: Validator<T>): Validator<T | null> {
    return (input, path = '') => {
      if (input === null) return null;
      return inner(input, path);
    };
  },

  /** a domain id: non-empty, sane length */
  id(): Validator<string> {
    return v.string({ min: 1, max: 256 });
  },

  /** pass anything through (for payloads already validated deeper) */
  any<T>(): Validator<T> {
    return (input) => input as T;
  },
};
