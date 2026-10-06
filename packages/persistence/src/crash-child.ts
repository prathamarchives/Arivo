/**
 * crash-child — run by crash.test.ts as a REAL child process.
 * argv: <target-file> <initial-json> <new-json> <crash-point|none>
 * writes the initial content atomically, then arms the crash point and
 * writes the new content. with a point armed, the process dies mid-write.
 */
import { armCrashPoint, writeFileSyncAtomic } from './index.ts';

const [target, initial, next, point] = process.argv.slice(2) as [string, string, string, string];

writeFileSyncAtomic(target, initial); // the good state on disk
if (point !== 'none') armCrashPoint(point);
writeFileSyncAtomic(target, next); // dies mid-write when armed
process.stdout.write('survived');
