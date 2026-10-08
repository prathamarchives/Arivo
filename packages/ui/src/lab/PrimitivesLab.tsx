/**
 * the primitive gallery — W5's evidence, rendered (the L6 gate).
 *
 * section 16 — every primitive, every state: click through Button →
 * hover → press → focus → loading → disabled; toggle the Toggle; pick a
 * tab; hover the tooltip; watch the progress travel. if every primitive
 * clearly belongs to the same physical family — same receipts, same
 * quiet voice, same materials — L6 is working.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  Text,
  Metadata,
  Surface,
  Divider,
  Button,
  IconButton,
  Toggle,
  Input,
  Textarea,
  Select,
  Badge,
  Progress,
  Status,
  Tabs,
  NavItem,
  Tooltip,
  Kbd,
  Selection,
  HighlightMarker,
  ProgressMarker,
  Icon,
  ICON_PATHS,
  type TextRole,
} from '../index.ts';

const TEXT_ROLES: [TextRole, string][] = [
  ['display', 'large statements'],
  ['screenTitle', 'screen titles'],
  ['title', 'panel titles'],
  ['emphasis', 'emphasized body'],
  ['body', 'body ui'],
  ['quiet', 'quiet chrome'],
  ['control', 'controls, list text'],
  ['label', 'control labels'],
  ['meta', 'data, counts, labels'],
  ['micro', 'the mono floor'],
  ['read', 'the author speaks'],
];

const TABS = [
  { id: 'shelf', label: 'shelf' },
  { id: 'desk', label: 'desk' },
  { id: 'archive', label: 'archive' },
];

export function PrimitivesLab(): ReactNode {
  const [tab, setTab] = useState('shelf');
  const [toggle, setToggle] = useState(true);
  const [toggle2, setToggle2] = useState(false);
  const [progress, setProgress] = useState(0.62);

  return (
    <section className="lab-section">
      <LabHead
        n="16"
        title="primitives — the L6 gallery"
        note="one family · every state · no invented values"
      />

      {/* typography */}
      <div className="lab-col">
        {TEXT_ROLES.map(([role, note]) => (
          <div key={role} className="lab-type-row">
            <Text as="span" role={role}>
              Reading is one relationship with the source
            </Text>
            <Metadata>
              {role} · {note}
            </Metadata>
          </div>
        ))}
      </div>

      <Divider />

      {/* surfaces */}
      <div className="lab-prims-grid">
        <Surface material="paper" bordered radius="surface" padding="s4">
          <Metadata>paper · bordered</Metadata>
          <Text role="quiet">matte, warm, quiet — the default wall.</Text>
        </Surface>
        <Surface material="paper" elevation="raised" radius="surface" padding="s4">
          <Metadata>paper · raised</Metadata>
          <Text role="quiet">contact + ambient — closeness and altitude.</Text>
        </Surface>
        <div className="lab-glass-backdrop">
          <Surface material="glass" radius="instrument" padding="s4">
            <Metadata>glass · instrument</Metadata>
            <Text role="quiet">floating chrome only. never wallpaper.</Text>
          </Surface>
        </div>
        <Surface material="ink" radius="generous" padding="s4">
          <Metadata>ink · authority</Metadata>
          <Text role="quiet" className="mat-ink-text">
            the serious expression — lab&apos;s favorite.
          </Text>
        </Surface>
        <Surface material="paper" sunken radius="surface" padding="s4">
          <Metadata>paper · sunken</Metadata>
          <Text role="quiet">the well — quiet insets and trays.</Text>
        </Surface>
      </div>

      <Divider />

      {/* actions — the full state matrix */}
      <div className="lab-prims-row">
        <Button>default</Button>
        <Button variant="solid">solid</Button>
        <Button variant="ghost">ghost</Button>
        <Button size="lg">large</Button>
        <Button disabled>disabled</Button>
        <Button state="loading">loading</Button>
        <Button state="saving">saving</Button>
        <Button state="error">retry</Button>
        <Button state="saved">saved</Button>
      </div>
      <div className="lab-prims-row">
        <IconButton label="search">
          <Icon name="search" />
        </IconButton>
        <IconButton label="delete">
          <Icon name="trash" />
        </IconButton>
        <IconButton label="collection">
          <Icon name="collection" />
        </IconButton>
        <IconButton label="disabled" disabled>
          <Icon name="download" />
        </IconButton>
        <span className="lab-prim-gap" />
        <Toggle label="booklight" checked={toggle} onCheckedChange={setToggle} />
        <Toggle label="compact rhythm" compact checked={toggle2} onCheckedChange={setToggle2} />
        <Toggle label="disabled switch" checked={false} disabled onCheckedChange={() => {}} />
      </div>

      <Divider />

      {/* inputs */}
      <div className="lab-prims-row">
        <Input placeholder="input — rest" style={{ width: '200px' }} />
        <Input state="error" defaultValue="input — error" style={{ width: '200px' }} />
        <Input state="modified" defaultValue="input — modified" style={{ width: '200px' }} />
        <Select aria-label="collection filter">
          <option>all books</option>
          <option>reading</option>
          <option>finished</option>
        </Select>
      </div>
      <div className="lab-prims-row">
        <Textarea placeholder="textarea — the note composer's seed" rows={2} style={{ width: '420px' }} />
      </div>

      <Divider />

      {/* feedback */}
      <div className="lab-prims-row">
        <Badge count={3} />
        <Badge count={128} />
        <Status state="saving" />
        <Status state="saved" />
        <Status state="processing" />
        <Status state="error" />
        <Status state="needs-attention" />
        <Status state="recovering" />
        <Status state="modified" />
      </div>
      <div className="lab-prims-col">
        <label className="lab-prim-label">
          <Metadata>progress — {Math.round(progress * 100)}% · scaleX transform</Metadata>
          <Progress value={progress} label="import progress" />
        </label>
        <label className="lab-prim-label">
          <Metadata>progress — indeterminate · the slow traveler</Metadata>
          <Progress value={0} indeterminate label="indexing" />
        </label>
        <label className="lab-prim-label">
          <Metadata>reading progress — the chrome hairline</Metadata>
          <ProgressMarker value={progress} />
        </label>
        <input
          className="lab-prim-slider"
          type="range"
          min={0}
          max={100}
          value={Math.round(progress * 100)}
          aria-label="progress demo"
          onChange={(e) => setProgress(Number(e.target.value) / 100)}
        />
      </div>

      <Divider />

      {/* navigation */}
      <div className="lab-prims-row">
        <Tabs tabs={TABS} selected={tab} onSelect={setTab} label="places" />
        <span className="lab-prim-gap" />
        <Tooltip text="an instrument — 400ms proximity acknowledgment">
          <Button variant="ghost">hover / focus me</Button>
        </Tooltip>
        <span className="lab-prim-gap" />
        <Kbd>⌘K</Kbd>
        <Kbd>⇧L</Kbd>
      </div>
      <div className="lab-prims-row">
        <div className="lab-prims-nav">
          <NavItem icon="book" label="shelf" selected />
          <NavItem icon="note" label="desk" />
          <NavItem icon="collection" label="archive" />
          <NavItem icon="bookmark" label="notes" badge={7} />
        </div>
      </div>

      <Divider />

      {/* icon language — the whole set, one stroke */}
      <div className="lab-icons-grid">
        {(Object.keys(ICON_PATHS) as (keyof typeof ICON_PATHS)[]).map((name) => (
          <div key={name} className="lab-icon-cell" title={name}>
            <Icon name={name} />
            <Metadata>{name}</Metadata>
          </div>
        ))}
      </div>

      <Divider />

      {/* reader objects */}
      <div className="lab-prims-col">
        <div className="lab-prims-row">
          <Metadata>selection — the annotation moment</Metadata>
          <Selection onPick={() => {}} onNote={() => {}} />
        </div>
        <Text role="read">
          the wash is a derived surface:{' '}
          <HighlightMarker identity="amber">the amber mark over text</HighlightMarker>,{' '}
          <HighlightMarker identity="sage">the sage mark</HighlightMarker>,{' '}
          <HighlightMarker identity="blue">the blue mark</HighlightMarker>,{' '}
          <HighlightMarker identity="rose">the rose mark</HighlightMarker>,{' '}
          <HighlightMarker identity="violet">the violet mark</HighlightMarker>, and the legacy{' '}
          <HighlightMarker identity="gray">pencil mark</HighlightMarker>. identity constant, light
          adapted.
        </Text>
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
