/**
 * the spatial runtime lab — W3's evidence, rendered.
 *
 * section 14 — the room at every width: a mini-room built ONLY from the
 * layout primitives (Container / Region / ReadingMeasure / Stack / Inline /
 * Box / Grid), inspected at 960 → 2560 and both temperaments. scaled to
 * fit the lab column — the claim under test is STRUCTURE: no broken
 * hierarchy, no arbitrary spacing, the reading body never exceeds the
 * measure, the workspace expands around it, regions transform instead of
 * collapsing randomly.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  Box,
  Stack,
  Inline,
  Grid,
  Region,
  Container,
  ReadingMeasure,
  Spacer,
} from '../layout/index.ts';

const WIDTHS = [960, 1280, 1440, 1920, 2560] as const;
const STAGE_MAX = 1040; // the lab column's honest width

function NavItem({ label, active }: { label: string; active?: boolean }): ReactNode {
  return (
    <Box
      as="li"
      paddingBlock="s2"
      paddingInline="s3"
      radius="interactive"
      background={active ? 'raised' : 'transparent'}
      className={`lab-spatial-nav-item ${active ? 'is-active' : ''}`}
    >
      <span className="meta-label">{label}</span>
    </Box>
  );
}

/** the mini-room — the L8 shell seed, built without a single positional style */
function MiniRoom(): ReactNode {
  return (
    <Container pad="s4" className="lab-spatial-room">
      <Inline gap="s4" align="stretch" className="lab-spatial-regions">
        <Region role="orientation" pad="s3" className="lab-spatial-rail">
          <Stack gap="s2" collapse as="ul">
            <NavItem label="shelf" active />
            <NavItem label="desk" />
            <NavItem label="archive" />
          </Stack>
          <Spacer step="s4" />
          <Box padding="s3" background="sunken" radius="surface">
            <span className="meta-label">orientation</span>
          </Box>
        </Region>

        <Region role="work" pad="s4" className="lab-spatial-work">
          <ReadingMeasure>
            <Stack gap="s3">
              <span className="type-title" style={{ fontSize: 'var(--text-lg)' }}>
                The sovereign column
              </span>
              <p className="lab-read-sample">
                The reading body tops out at 68ch. The monitor grew; the page refused. The
                workspace expands around this column — margins are useful space where tools,
                notes, and the booklight breathe.
              </p>
              <Grid gap="s3" min="narrow">
                <Box padding="s3" background="raised" radius="surface" bordered>
                  <span className="meta-label">marginalia</span>
                </Box>
                <Box padding="s3" background="raised" radius="surface" bordered>
                  <span className="meta-label">references</span>
                </Box>
                <Box padding="s3" background="raised" radius="surface" bordered>
                  <span className="meta-label">notes</span>
                </Box>
              </Grid>
            </Stack>
          </ReadingMeasure>
        </Region>

        <Region role="context" pad="s3" className="lab-spatial-context">
          <Stack gap="s3">
            <Box padding="s4" background="raised" radius="surface" bordered>
              <Stack gap="s2">
                <span className="meta-label">workbench</span>
                <span className="lab-mono-sample">instruments live here</span>
              </Stack>
            </Box>
            <Box padding="s3" background="sunken" radius="surface">
              <span className="meta-label">attachments</span>
            </Box>
          </Stack>
        </Region>
      </Inline>
    </Container>
  );
}

export function SpatialRuntimeLab(): ReactNode {
  const [width, setWidth] = useState<number>(1280);
  const scale = Math.min(1, STAGE_MAX / width);

  return (
    <section className="lab-section">
      <LabHead
        n="14"
        title="spatial runtime — the room at every width"
        note="960 → 2560 · primitives only · no positional css"
      />
      <div className="lab-spatial-controls">
        {WIDTHS.map((w) => (
          <button
            key={w}
            className={`btn ${width === w ? 'btn-solid' : ''}`}
            onClick={() => setWidth(w)}
          >
            {w}
          </button>
        ))}
        <input
          className="lab-spatial-slider"
          type="range"
          min={960}
          max={2560}
          step={20}
          value={width}
          aria-label="stage width"
          onChange={(e) => setWidth(Number(e.target.value))}
        />
        <span className="meta-label">
          stage {width}px · scale {scale.toFixed(2)} · structure is the claim, not pixels
        </span>
      </div>
      <div className="lab-spatial-stage">
        <div
          className="lab-spatial-frame"
          style={{ width: `${width}px`, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          <MiniRoom />
        </div>
      </div>
      <div className="lab-spatial-notes">
        <span className="meta-label">
          what to verify: the measure column never widens past 68ch · the work region absorbs
          the growth · orientation/context hold their structure · den breathes, lab tightens
          (region density) · nothing re-flows arbitrarily
        </span>
      </div>
    </section>
  );
}

function LabHead({ n, title, note }: { n: string; title: string; note?: string }): ReactNode {
  return (
    <div className="lab-h">
      <span className="meta-label">{n}</span>
      <span className="type-title">{title}</span>
      {note ? <span className="meta-label">{note}</span> : null}
    </div>
  );
}
