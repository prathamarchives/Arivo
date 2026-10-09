/**
 * Shell — L8. the app becomes a room, not a router.
 *
 * three camera positions over one continuous place:
 *   shelf · desk · archive
 * the orientation rail is persistent furniture — it never remounts on
 * place change (spatial memory); the work region is the camera. the
 * shell's visibility follows attention: full while browsing, quiet at
 * the desk, absent when the text owns the eyes. the context region
 * (right workbench) is the desk's L10 future — the slot is structural,
 * it does not render empty furniture.
 */
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRoom, shellVisibility } from '../stores/room.ts';
import { OrientationRail } from './OrientationRail.tsx';
import { ArchiveRoom } from './ArchiveRoom.tsx';
import { LibraryScreen } from '../screens/Library.tsx';
import { ReaderScreen } from '../screens/Reader.tsx';

export function Shell(): ReactNode {
  const place = useRoom((s) => s.place);
  const attention = useRoom((s) => s.attention);
  const desk = useRoom((s) => s.desk);
  const poke = useRoom((s) => s.poke);

  /* the shell owns chrome quietness — edge proximity wakes it, the idle
   * budget (in the room store) quiets it. one truth, no per-screen mice.
   * the left strip wakes the ghost rail (absent state): the approach
   * corridor is generous but narrow enough to belong to the text. */
  useEffect(() => {
    const onMove = (e: MouseEvent): void => {
      const nearTop = e.clientY < 72;
      const nearBottom = e.clientY > window.innerHeight - 84;
      const nearLeft = e.clientX < 24;
      if (nearTop || nearBottom || nearLeft) poke();
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [poke]);

  const visibility = shellVisibility(place, attention);

  return (
    <div className={`shell shell-${visibility}`} data-place={place} data-shell={visibility}>
      <OrientationRail />
      <main className="shell-work" data-region="work" aria-label="work">
        {place === 'shelf' && <LibraryScreen />}
        {place === 'desk' && desk && <ReaderScreen bookId={desk.bookId} key={desk.bookId} />}
        {place === 'archive' && <ArchiveRoom />}
        {/* the desk without a desk-context cannot occur (goDesk always
         * creates one) — the guard exists so the room never shows a hole */}
        {place === 'desk' && !desk && (
          <div className="shell-resting meta-label">the desk is empty — open a book from the shelf</div>
        )}
      </main>
    </div>
  );
}
