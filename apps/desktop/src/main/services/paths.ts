/**
 * path guards — the renderer never hands a raw path to a write primitive.
 * import reads a user-chosen source; settings may redirect the library root,
 * but never to a filesystem root and never to a relative path.
 */
import path from 'node:path';
import { ArivoError } from '@arivo/core';

/** a sane library root: absolute, not the filesystem root, not a UNC share root */
export function validateLibraryRoot(candidate: string): string {
  if (typeof candidate !== 'string' || candidate.trim().length === 0) {
    throw new ArivoError('PATH_INVALID', 'the library location is empty');
  }
  // the ORIGINAL string must already be absolute — resolve() would launder
  // a relative path into an absolute one and hide the escape
  if (!path.isAbsolute(candidate)) {
    throw new ArivoError('PATH_INVALID', 'the library location must be an absolute path', {
      received: candidate,
    });
  }
  const abs = path.resolve(candidate);
  const parsed = path.parse(abs);
  if (abs === parsed.root) {
    throw new ArivoError('PATH_INVALID', 'refusing to use a filesystem root as the library', {
      received: candidate,
    });
  }
  return abs;
}

/** a source file the renderer asked to import: absolute + right extension */
export function validateImportSource(candidate: string): string {
  if (typeof candidate !== 'string' || candidate.length === 0) {
    throw new ArivoError('PATH_INVALID', 'the import path is empty');
  }
  if (!path.isAbsolute(candidate)) {
    throw new ArivoError('PATH_INVALID', 'import paths must be absolute', { received: candidate });
  }
  if (!/\.(epub|pdf)$/i.test(candidate)) {
    throw new ArivoError('UNSUPPORTED_FORMAT', 'arivo imports epub and pdf', { received: candidate });
  }
  return path.resolve(candidate);
}

/** containment: resolved must live inside parent (defends id-shaped tricks) */
export function ensureInside(parent: string, resolved: string, label: string): string {
  const normParent = path.resolve(parent) + path.sep;
  const normResolved = path.resolve(resolved);
  if (normResolved !== path.resolve(parent) && !normResolved.startsWith(normParent)) {
    throw new ArivoError('PATH_ESCAPE', `${label} resolves outside its allowed directory`, {
      resolved,
    });
  }
  return normResolved;
}
