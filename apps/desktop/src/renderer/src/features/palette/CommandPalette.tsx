import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { SearchHit } from '@arivo/core';
import { Kbd } from '@arivo/ui';
import { api, platform } from '../../services/api.ts';
import { useLibrary } from '../../stores/library.ts';
import { useSettings } from '../../stores/settings.ts';
import { useUi } from '../../stores/ui.ts';
import {
  IconSearch,
  IconBook,
  IconNote,
  IconPlus,
  IconCollection,
} from '../../components/icons.tsx';

interface Item {
  id: string;
  kind: 'book' | 'highlight' | 'collection' | 'action';
  title: string;
  context: string | null;
  run: () => void;
}

export function CommandPalette(): ReactNode {
  const { paletteOpen, setPaletteOpen, openReader, toast, backToLibrary } = useUi();
  const { books, importDialog, refresh } = useLibrary();
  const { settings, set } = useSettings();
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [remoteHits, setRemoteHits] = useState<SearchHit[]>([]);

  useEffect(() => {
    if (paletteOpen) {
      setQ('');
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [paletteOpen]);

  useEffect(() => {
    if (!paletteOpen) return;
    const t = setTimeout(() => {
      if (q.trim().length >= 2) {
        void api.search.query(q.trim()).then(setRemoteHits);
      } else {
        setRemoteHits([]);
      }
    }, 140);
    return () => clearTimeout(t);
  }, [q, paletteOpen]);

  const items = useMemo<Item[]>(() => {
    const list: Item[] = [];
    const ql = q.trim().toLowerCase();

    for (const b of books) {
      if (
        ql.length === 0 ||
        b.title.toLowerCase().includes(ql) ||
        b.authors.join(' ').toLowerCase().includes(ql)
      ) {
        list.push({
          id: `book-${b.id}`,
          kind: 'book',
          title: b.title,
          context: b.authors.join(', ') || null,
          run: () => {
            setPaletteOpen(false);
            openReader(b.id);
          },
        });
      }
    }

    for (const hit of remoteHits) {
      if (hit.kind !== 'highlight') continue;
      list.push({
        id: `hl-${hit.id}`,
        kind: 'highlight',
        title: hit.title,
        context: hit.context,
        run: () => {
          setPaletteOpen(false);
          if (hit.bookId) openReader(hit.bookId);
        },
      });
    }

    if (ql.length === 0 || 'import books'.includes(ql)) {
      list.push({
        id: 'action-import',
        kind: 'action',
        title: 'import books',
        context: 'epub · pdf',
        run: () => {
          setPaletteOpen(false);
          void importDialog().then((r) => {
            const ok = r.filter((x) => x.ok).length;
            toast(ok > 0 ? `${ok} imported` : 'import cancelled');
          });
        },
      });
    }

    const themeLabels: Record<string, string> = { paper: 'sepia', sepia: 'night', night: 'paper' };
    const nextTheme = themeLabels[settings.theme] ?? 'paper';
    const themeIcon =
      nextTheme === 'night' ? 'night' : nextTheme === 'sepia' ? 'lamp' : 'day';
    if (ql.length === 0 || 'reading theme'.includes(ql)) {
      list.push({
        id: 'action-theme',
        kind: 'action',
        title: `reading theme → ${nextTheme}`,
        context: 'paper · sepia · night',
        run: () => {
          set({ theme: nextTheme as 'paper' | 'sepia' | 'night' });
          setPaletteOpen(false);
        },
      });
      void themeIcon;
    }

    if (platform === 'electron' && (ql.length === 0 || 'rebuild index'.includes(ql))) {
      list.push({
        id: 'action-rebuild',
        kind: 'action',
        title: 'rebuild the index',
        context: 'truth → sqlite, zero loss',
        run: () => {
          setPaletteOpen(false);
          void api.dev.rebuildIndex().then((r) => {
            void refresh();
            toast(`index rebuilt · ${r.books} books · ${r.highlights} highlights`);
          });
        },
      });
    }

    if (ql.length === 0 || 'library'.includes(ql)) {
      list.push({
        id: 'action-library',
        kind: 'action',
        title: 'back to library',
        context: null,
        run: () => {
          setPaletteOpen(false);
          backToLibrary();
        },
      });
    }

    return list.slice(0, 14);
  }, [q, books, remoteHits, settings.theme, set, setPaletteOpen, openReader, importDialog, toast, refresh, backToLibrary, platform]);

  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, items.length - 1)));
  }, [items.length]);

  if (!paletteOpen) return null;

  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[cursor]?.run();
    } else if (e.key === 'Escape') {
      setPaletteOpen(false);
    }
  };

  const iconFor = (kind: Item['kind']): ReactNode =>
    kind === 'book' ? <IconBook /> : kind === 'highlight' ? <IconNote /> : kind === 'collection' ? <IconCollection /> : <IconPlus />;

  return (
    <>
      <div className="menu-scrim" onClick={() => setPaletteOpen(false)} />
      <div className="palette glass rise" role="dialog" aria-label="command palette">
        <div className="palette-input-row">
          <IconSearch />
          <input
            ref={inputRef}
            value={q}
            placeholder="books, highlights, actions…"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            aria-label="search"
          />
          <span className="meta-label">
            <Kbd>esc</Kbd>
          </span>
        </div>
        <div className="palette-results">
          {items.length === 0 && <div className="palette-empty meta-label">nothing found</div>}
          {items.map((item, i) => (
            <button
              key={item.id}
              className={`palette-item${i === cursor ? ' palette-cursor' : ''}`}
              onMouseEnter={() => setCursor(i)}
              onClick={() => item.run()}
            >
              {iconFor(item.kind)}
              <span className="palette-item-title">{item.title}</span>
              {item.context && <span className="meta-label palette-item-context">{item.context}</span>}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
