import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { DiagnosticsReport, SessionStats, ReadingProfile } from '@arivo/core';
import { READING_PROFILES, activeProfile, FONT_STEPS, LINE_HEIGHTS, MEASURES } from '@arivo/core';
import { api, platform } from '../services/api.ts';
import { useSettings } from '../stores/settings.ts';
import { useRoom } from '../stores/room.ts';
import { Button, IconButton, Kbd } from '@arivo/ui';
import {
  IconX,
  IconSettings,
  IconFolder,
  IconPulse,
  IconDownload,
  IconInfo,
} from '../components/icons.tsx';

function fmtMs(ms: number): string {
  if (ms <= 0) return '—';
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function fmtDay(day: number): string {
  return new Date(day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** quiet numbers: a 14-day bar row, no axis, no gamification */
function ReadingLife(): ReactNode {
  const [stats, setStats] = useState<SessionStats | null>(null);
  useEffect(() => {
    void api.sessions.stats().then(setStats);
  }, []);
  if (!stats) {
    return <div className="meta-label">gathering the numbers…</div>;
  }
  if (stats.sessions === 0) {
    return (
      <div className="settings-empty meta-label">
        no reading sessions yet — open a book and the time starts counting
      </div>
    );
  }
  const maxMs = Math.max(1, ...stats.days.map((d) => d.ms));
  return (
    <div className="reading-life">
      <div className="stats-row">
        <div className="stat">
          <span className="stat-value display">{fmtMs(stats.totalMs)}</span>
          <span className="meta-label">all time</span>
        </div>
        <div className="stat">
          <span className="stat-value display">{fmtMs(stats.weekMs)}</span>
          <span className="meta-label">this week</span>
        </div>
        <div className="stat">
          <span className="stat-value display">
            {stats.streakDays > 0 ? `${stats.streakDays}d` : '—'}
          </span>
          <span className="meta-label">streak</span>
        </div>
        <div className="stat">
          <span className="stat-value display">{stats.sessions}</span>
          <span className="meta-label">sessions</span>
        </div>
      </div>
      {stats.days.length > 0 && (
        <div className="stat-days" role="img" aria-label="reading time, last 14 days">
          {stats.days.map((d) => (
            <div
              key={d.day}
              className="stat-day-bar"
              style={{ height: `${Math.max(8, Math.round((d.ms / maxMs) * 100))}%` }}
              title={`${fmtDay(d.day)} · ${fmtMs(d.ms)}`}
            />
          ))}
        </div>
      )}
      {stats.books.length > 0 && (
        <div className="stat-books">
          {stats.books.map((b) => (
            <div key={b.bookId} className="stat-book">
              <span className="stat-book-title">{b.title}</span>
              <span className="meta-label">{fmtMs(b.ms)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DiagnosticsPanel(): ReactNode {
  const toast = useRoom((s) => s.toast);
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  useEffect(() => {
    void api.diagnostics.report().then(setReport);
  }, []);
  const [exporting, setExporting] = useState(false);
  return (
    <div className="settings-block">
      {report ? (
        <p className="meta-label settings-facts">
          {report.library.books} books · {report.library.highlights} highlights ·{' '}
          {report.appVersion} ·{' '}
          {report.lastReconciliation
            ? `index checked ${new Date(report.lastReconciliation.at).toISOString().slice(0, 10)}`
            : 'index not yet checked'}
        </p>
      ) : (
        <p className="meta-label">…</p>
      )}
      <div className="settings-actions">
        <Button
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            try {
              const saved = await api.diagnostics.export();
              toast(saved ? 'diagnostics report saved' : 'export cancelled');
            } catch {
              toast('the report could not be exported');
            } finally {
              setExporting(false);
            }
          }}
        >
          <IconDownload />
          export diagnostics
        </Button>
        <span className="meta-label">counts and statuses only — never your book text</span>
      </div>
    </div>
  );
}

export function SettingsScreen(): ReactNode {
  const settingsOpen = useRoom((s) => s.settingsOpen);
  const setSettingsOpen = useRoom((s) => s.setSettingsOpen);
  const toast = useRoom((s) => s.toast);
  const { settings, set } = useSettings();
  const [restartNeeded, setRestartNeeded] = useState(false);

  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settingsOpen, setSettingsOpen]);

  if (!settingsOpen) return null;

  return (
    <div className="settings-overlay fade-in" role="dialog" aria-label="settings">
      <div className="menu-scrim" onClick={() => setSettingsOpen(false)} />
      <div className="settings-page rise">
        <header className="drawer-head">
          <span className="meta-label">
            <IconSettings /> settings
          </span>
          <IconButton label="close settings" onClick={() => setSettingsOpen(false)}>
            <IconX />
          </IconButton>
        </header>
        <div className="drawer-body settings-body">
          <section className="detail-section">
            <div className="meta-label section-label">reading</div>
            {/* the typography the reader's type panel owned — absorbed
                here (v0.3.2): profile, size, leading, measure, flow, page.
                the light lives on the rail, not here. */}
            <div className="settings-row">
              <span className="settings-row-label">profile</span>
              <div className="type-flow">
                {(Object.keys(READING_PROFILES) as ReadingProfile[]).map((key) => (
                  <button
                    key={key}
                    className={`chip${activeProfile(settings) === key ? ' chip-active' : ''}`}
                    onClick={() => set(READING_PROFILES[key])}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-row">
              <span className="settings-row-label">size</span>
              <div className="type-flow">
                {FONT_STEPS.map((px, i) => (
                  <button
                    key={px}
                    className={`type-step${settings.fontStep === i ? ' type-step-active' : ''}`}
                    style={{ fontSize: `${10 + i * 2}px` }}
                    onClick={() => set({ fontStep: i })}
                    aria-label={`${px} pixels`}
                  >
                    Aa
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-row">
              <span className="settings-row-label">leading</span>
              <div className="type-flow">
                {LINE_HEIGHTS.map((lh) => (
                  <button
                    key={lh}
                    className={`chip${settings.lineHeight === lh ? ' chip-active' : ''}`}
                    onClick={() => set({ lineHeight: lh })}
                  >
                    {lh}
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-row">
              <span className="settings-row-label">measure</span>
              <div className="type-flow">
                {MEASURES.map((m) => (
                  <button
                    key={m}
                    className={`chip${settings.measure === m ? ' chip-active' : ''}`}
                    onClick={() => set({ measure: m })}
                    aria-label={`${m} pixel column`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-row">
              <span className="settings-row-label">flow</span>
              <div className="type-flow">
                <button
                  className={`chip${settings.flow === 'paginated' ? ' chip-active' : ''}`}
                  onClick={() => set({ flow: 'paginated' })}
                >
                  pages
                </button>
                <button
                  className={`chip${settings.flow === 'scrolled' ? ' chip-active' : ''}`}
                  onClick={() => set({ flow: 'scrolled' })}
                >
                  scroll
                </button>
              </div>
            </div>
            {settings.flow === 'paginated' && (
              <div className="settings-row">
                <span className="settings-row-label">page</span>
                <div className="type-flow">
                  <button
                    className={`chip${settings.pageMode === 'single' ? ' chip-active' : ''}`}
                    onClick={() => set({ pageMode: 'single' })}
                  >
                    one page
                  </button>
                  <button
                    className={`chip${settings.pageMode === 'auto' ? ' chip-active' : ''}`}
                    onClick={() => set({ pageMode: 'auto' })}
                  >
                    two pages
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="detail-section">
            <div className="meta-label section-label">
              <IconFolder /> library
            </div>
            <p className="settings-path mono">{settings.booksDir ?? '~/Arivo (default)'}</p>
            {platform === 'electron' ? (
              <div className="settings-actions">
                <Button
                  onClick={async () => {
                    try {
                      const dir = await api.settings.pickBooksDir();
                      if (!dir) return;
                      set({ booksDir: dir });
                      setRestartNeeded(true);
                      toast('library folder set — restart arivo to use it');
                    } catch {
                      toast('that folder cannot be a library');
                    }
                  }}
                >
                  <IconFolder />
                  choose folder…
                </Button>
                <span className="meta-label">
                  books stay as plain files — yours, browsable, portable
                </span>
              </div>
            ) : (
              <p className="meta-label">the folder setting lives in the desktop app</p>
            )}
            {restartNeeded && (
              <p className="settings-note meta-label">
                <IconInfo /> the new folder opens on the next launch — this session keeps using the
                current one
              </p>
            )}
            <div className="settings-row">
              <span className="settings-row-label">view</span>
              <div className="type-flow">
                <button
                  className={`chip${settings.libraryView === 'grid' ? ' chip-active' : ''}`}
                  onClick={() => set({ libraryView: 'grid' })}
                >
                  grid
                </button>
                <button
                  className={`chip${settings.libraryView === 'list' ? ' chip-active' : ''}`}
                  onClick={() => set({ libraryView: 'list' })}
                >
                  list
                </button>
              </div>
            </div>
            <div className="settings-row">
              <span className="settings-row-label">covers</span>
              <div className="type-flow">
                {(['s', 'm', 'l'] as const).map((size) => (
                  <button
                    key={size}
                    className={`chip${settings.librarySize === size ? ' chip-active' : ''}`}
                    onClick={() => set({ librarySize: size })}
                  >
                    {size === 's' ? 'small' : size === 'm' ? 'medium' : 'large'}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="detail-section">
            <div className="meta-label section-label">
              <IconPulse /> reading life
            </div>
            <ReadingLife />
          </section>

          <section className="detail-section">
            <div className="meta-label section-label">diagnostics</div>
            <DiagnosticsPanel />
          </section>

          <p className="settings-foot meta-label">
            everything local · no account · no network · <Kbd>Esc</Kbd> closes
          </p>
        </div>
      </div>
    </div>
  );
}
