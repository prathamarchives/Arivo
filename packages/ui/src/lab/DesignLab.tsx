/**
 * the design lab — L2 perceptual foundations, rendered as evidence.
 * every specimen shows its token name. the lab toggles temperament and
 * lighting live so every claim can be inspected under all six room
 * conditions. experiments live here; production never consumes an
 * unproven effect.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  SPACING,
  RADIUS,
  TYPE_ROLES,
  DURATIONS,
  EASINGS,
  ANNOTATION,
} from './lab-data.ts';
import { MotionRuntimeLab } from './MotionLab.tsx';
import { SpatialRuntimeLab } from './SpatialLab.tsx';

type Temperament = 'den' | 'lab';
type Lighting = 'paper' | 'sepia' | 'night';

function LabHead({ n, title, note }: { n: string; title: string; note?: string }): ReactNode {
  return (
    <div className="lab-h">
      <span className="meta-label">{n}</span>
      <span className="type-title">{title}</span>
      {note ? <span className="meta-label">{note}</span> : null}
    </div>
  );
}

function Swatch({ name, cssVar }: { name: string; cssVar: string }): ReactNode {
  return (
    <div className="lab-swatch">
      <div className="lab-swatch-chip" style={{ background: `var(${cssVar})` }} />
      <div className="lab-swatch-label meta-label">{name}</div>
    </div>
  );
}

const ROOM = {
  den: 'warm · comfortable · allows atmosphere',
  lab: 'monastic · precise · suppresses atmosphere',
} as const;

export function DesignLab(): ReactNode {
  const [temperament, setTemperament] = useState<Temperament>('den');
  const [lighting, setLighting] = useState<Lighting>('paper');

  const setRoom = (t: Temperament, l: Lighting): void => {
    const root = document.documentElement;
    root.setAttribute('data-temperament', t);
    root.setAttribute('data-theme', l);
    setTemperament(t);
    setLighting(l);
  };

  return (
    <div className="lab">
      <div className="lab-inner">
        <header className="lab-header">
          <div>
            <div className="type-wordmark lab-title">arivo.</div>
            <div className="meta-label">design lab — l2 perceptual foundations</div>
          </div>
          <div className="lab-controls">
            {(['den', 'lab'] as const).map((t) => (
              <button
                key={t}
                className={`btn ${temperament === t ? 'btn-solid' : ''}`}
                onClick={() => setRoom(t, lighting)}
                title={ROOM[t]}
              >
                {t}
              </button>
            ))}
            <span className="lab-mono-sample">·</span>
            {(['paper', 'sepia', 'night'] as const).map((l) => (
              <button
                key={l}
                className={`btn ${lighting === l ? 'btn-solid' : ''}`}
                onClick={() => setRoom(temperament, l)}
              >
                {l}
              </button>
            ))}
          </div>
        </header>

        {/* ---------------- typography ---------------- */}
        <section className="lab-section">
          <LabHead n="01" title="typography — the room's voice" note="helvetica 400/700 · 300 wordmark-only" />
          <div className="lab-col">
            {TYPE_ROLES.map(([token, role]) => (
              <div key={token} className="lab-type-row">
                <span className="lab-type-sample" style={{ fontSize: `var(${token})` }}>
                  Reading is one relationship with the source
                </span>
                <span className="meta-label">
                  {token.replace('--text-', '')} · {role}
                </span>
              </div>
            ))}
            <div className="lab-type-row">
              <span className="lab-type-sample type-title" style={{ fontSize: 'var(--text-lg)' }}>
                Bold is spent deliberately — titles only
              </span>
              <span className="meta-label">700 · .type-title</span>
            </div>
          </div>
          <div className="lab-col">
            <div className="lab-mono-sample">metadata voice — jetbrains mono 11px / 0.08em uppercase</div>
            <p className="lab-read-sample">
              The author&apos;s voice is Literata: sovereign over its own grid, five size
              steps, generous leading, a measure that never stretches with the monitor.
              The room grows around the page.
            </p>
            <span className="meta-label">--font-read · 68ch max · literata</span>
          </div>
        </section>

        {/* ---------------- color ---------------- */}
        <section className="lab-section">
          <LabHead n="02" title="color — the room under this light" note={`${temperament} · ${lighting}`} />
          <div className="lab-grid">
            <Swatch name="bg — canvas" cssVar="--bg" />
            <Swatch name="bg-raised — sheet" cssVar="--bg-raised" />
            <Swatch name="bg-sunken — well" cssVar="--bg-sunken" />
            <Swatch name="ink" cssVar="--ink" />
            <Swatch name="ink-2" cssVar="--ink-2" />
            <Swatch name="ink-3" cssVar="--ink-3" />
            <Swatch name="line" cssVar="--line" />
            <Swatch name="line-strong" cssVar="--line-strong" />
            <Swatch name="accent — system signal" cssVar="--accent" />
          </div>
        </section>

        {/* ---------------- annotation identity ---------------- */}
        <section className="lab-section">
          <LabHead n="03" title="annotation identity — the saturation privilege" note="constant across all rooms · law 38" />
          <div className="lab-anno-grid">
            {ANNOTATION.map(([token, value]) => (
              <div key={token} className="lab-anno">
                <div className="lab-anno-dot" style={{ background: `var(${token})` }} />
                <span className="meta-label">
                  {token.replace('--anno-', '')} {value}
                </span>
              </div>
            ))}
          </div>
          <div className="lab-wash-row">
            <span>
              Washes are derived surfaces — <span className="ar-wash" style={{ background: 'var(--wash-amber)' }}>the amber wash over text</span>,{' '}
              <span style={{ background: 'var(--wash-sage)' }}>the sage wash</span>,{' '}
              <span style={{ background: 'var(--wash-blue)' }}>the blue wash</span>,{' '}
              <span style={{ background: 'var(--wash-rose)' }}>the rose wash</span>,{' '}
              <span style={{ background: 'var(--wash-violet)' }}>the violet wash</span>. The identity never changes; only the light does.
            </span>
          </div>
        </section>

        {/* ---------------- material stack ---------------- */}
        <section className="lab-section">
          <LabHead n="04" title="material — matte paper, scarce glass" note="hard system · soft skin" />
          <div className="lab-material-grid">
            <div className="lab-panel surface">
              <span className="meta-label">.surface — matte paper</span>
              <span>Walls are matte. Warm, quiet, low reflectivity, fine grain.</span>
            </div>
            <div className="lab-panel raised-2">
              <span className="meta-label">.raised-2 — elevation 2</span>
              <span>Contact shadow for closeness, ambient shadow for altitude.</span>
            </div>
            <div className="lab-panel" style={{ background: 'var(--bg-sunken)' }}>
              <span className="meta-label">bg-sunken — the well</span>
              <span>Sunken ground for wells and quiet insets.</span>
            </div>
            <div className="lab-glass-backdrop">
              <div className="lab-panel glass">
                <span className="meta-label">.glass — floating instrument</span>
                <span>Blur 16px, saturation lift, hairline rim, top light catch. Never wallpaper.</span>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- elevation ---------------- */}
        <section className="lab-section">
          <LabHead n="05" title="elevation — contact + ambient" note="dark rooms step values, not shadows" />
          <div className="lab-elev-grid">
            <div className="lab-elev lab-elev-1">
              <span className="meta-label">--elevation-1</span>
            </div>
            <div className="lab-elev lab-elev-2">
              <span className="meta-label">--elevation-2</span>
            </div>
            <div className="lab-elev lab-elev-3">
              <span className="meta-label">--elevation-3</span>
            </div>
          </div>
        </section>

        {/* ---------------- spacing ---------------- */}
        <section className="lab-section">
          <LabHead n="06" title="spacing — the 4/8 ladder" note="nothing off-scale without a recorded exception" />
          <div className="lab-col">
            {SPACING.map(([token, px]) => (
              <div key={token} className="lab-space-row">
                <span className="meta-label" style={{ width: '80px' }}>{token}</span>
                <div className="lab-space-bar" style={{ width: `${px}px` }} />
                <span className="meta-label">{px}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- radius ---------------- */}
        <section className="lab-section">
          <LabHead n="07" title="radius — proximity to the hand" note="walls restrained · instruments round" />
          <div className="lab-radius-grid">
            {RADIUS.map(([token, px]) => (
              <div key={token} className="lab-radius-tile" style={{ borderRadius: `var(${token})` }}>
                <span className="meta-label">
                  {token.replace('--r-', '')}
                  <br />
                  {px === 999 ? 'pill' : px}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- states & controls ---------------- */}
        <section className="lab-section">
          <LabHead n="08" title="controls & states" note="rest · hover · press · focus · disabled" />
          <div className="lab-controls-row">
            <button className="btn">default</button>
            <button className="btn btn-solid">solid</button>
            <button className="btn btn-ghost">ghost</button>
            <button className="btn" disabled>disabled</button>
            <button className="btn btn-lg">large</button>
          </div>
          <div className="lab-controls-row">
            <input className="input" placeholder="input — rest" style={{ width: '220px' }} />
            <input className="input" defaultValue="input — focus ring" style={{ width: '220px' }} />
            <span className="kbd">⌘K</span>
            <span className="kbd">⇧L</span>
          </div>
        </section>

        {/* ---------------- booklight ---------------- */}
        <section className="lab-section">
          <LabHead n="09" title="booklight — the book tints the light" note="den only · low-teens peak alpha" />
          <div className="lab-booklight">
            <div className="lab-booklight-content lab-col">
              <span className="meta-label">
                --aura · hsl(var(--aura-h) var(--aura-s) var(--aura-l) / var(--aura-alpha))
              </span>
              <span>
                The current book changes the light around Arivo — never the walls, never
                the text, never the annotation identity. Lab suppresses it entirely;
                Den lets it breathe at whisper strength.
              </span>
            </div>
          </div>
        </section>

        {/* ---------------- motion ---------------- */}
        <section className="lab-section">
          <LabHead n="10" title="motion — viscous precision" note="hover the tracks · no bounce, ever" />
          <div className="lab-motion-row">
            {EASINGS.map(([token, _bezier, job]) => (
              <div key={token} className={`lab-motion-chip lab-m-${token.replace('--ease-', '')}`}>
                <div className="lab-motion-track">
                  <div className="lab-motion-dot" />
                </div>
                <span className="meta-label">
                  {token.replace('--ease-', '')} · {job}
                </span>
              </div>
            ))}
          </div>
          <div className="lab-col">
            {DURATIONS.map(([token, ms]) => (
              <div key={token} className="lab-type-row">
                <span className="meta-label" style={{ width: '180px' }}>{token}</span>
                <span className="lab-type-sample">{ms}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- motion runtime (L3 — the engine) ---------------- */}
        <MotionRuntimeLab />

        {/* ---------------- spatial runtime (L4 — the room) ---------------- */}
        <SpatialRuntimeLab />

        <footer className="lab-header" style={{ borderBottom: 'none', borderTop: '1px solid var(--line)', paddingTop: 'var(--s6)' }}>
          <span className="meta-label">
            density: {temperament === 'den' ? '×1.10 · breathing' : '×0.90 · tight'} · grain: matte paper · z-space: 0/1/10/20/30/40
          </span>
          <span className="meta-label">reduced-motion twins: every duration has one</span>
        </footer>
      </div>
    </div>
  );
}
