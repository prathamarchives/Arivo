#!/usr/bin/env node
/**
 * verifies that a GitHub release actually serves a working electron-updater
 * feed: latest.yml exists, its version matches the tag, the installer asset
 * is downloadable, and its sha512 matches the feed byte-for-byte.
 *
 * this is the closing assertion of the release loop (docs/RELEASE-AND-UPDATES.md):
 * if this passes, any installed 0.2.1+ build can discover and install the update.
 *
 * usage: node scripts/verify-update-feed.mjs [expected-tag]
 * env:   GITHUB_REPOSITORY (default prathamarchives/Arivo)
 */
import { createHash } from 'node:crypto';

const repo = process.env['GITHUB_REPOSITORY'] ?? 'prathamarchives/Arivo';
const expectedTag = process.argv[2] ?? null;
const base = `https://github.com/${repo}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetries(label, attempts, fn) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      process.stderr.write(`[feed] ${label}: attempt ${i + 1}/${attempts} failed — retrying\n`);
      await sleep(5000);
    }
  }
  throw new Error(`${label} failed after ${attempts} attempts: ${String(lastError)}`);
}

async function latestReleaseTag() {
  return withRetries('read releases.atom', 6, async () => {
    const res = await fetch(`${base}/releases.atom`);
    if (!res.ok) throw new Error(`releases.atom → HTTP ${res.status}`);
    const xml = await res.text();
    // the atom feed orders entries newest-first; the title is the tag
    const match = xml.match(/<entry>[\s\S]*?<title>([^<]+)<\/title>/);
    if (!match) throw new Error('no release entries in the atom feed');
    return match[1].trim();
  });
}

async function downloadLatestYml(tag) {
  return withRetries(`download latest.yml @ ${tag}`, 6, async () => {
    const res = await fetch(`${base}/releases/download/${tag}/latest.yml`);
    if (!res.ok) throw new Error(`latest.yml → HTTP ${res.status}`);
    return await res.text();
  });
}

async function download(url) {
  return withRetries(`download ${url}`, 4, async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  });
}

function fail(message) {
  process.stderr.write(`[feed] FAIL: ${message}\n`);
  process.exit(1);
}

const tag = await latestReleaseTag();
process.stdout.write(`[feed] latest release: ${tag}\n`);

if (expectedTag && tag !== expectedTag) {
  fail(`expected release ${expectedTag}, the feed reports ${tag}`);
}

const yml = await downloadLatestYml(tag);
const version = /^version:\s*(.+)$/m.exec(yml)?.[1]?.trim();
const path = /^path:\s*(.+)$/m.exec(yml)?.[1]?.trim();
const sha512 = /^sha512:\s*(.+)$/m.exec(yml)?.[1]?.trim();

if (!version || !path || !sha512) {
  fail(`latest.yml is malformed — version/path/sha512 missing:\n${yml}`);
}

if (tag.replace(/^v/, '') !== version) {
  fail(`tag ${tag} and feed version ${version} disagree`);
}

const expectedArtifact = `Arivo-${version}-setup.exe`;
if (path !== expectedArtifact) {
  fail(`feed path ${path} is not the expected artifact ${expectedArtifact}`);
}

process.stdout.write(`[feed] latest.yml: version=${version} path=${path}\n`);

// the blockmap is the differential-update companion asset
const blockmapRes = await fetch(`${base}/releases/download/${tag}/${path}.blockmap`);
if (!blockmapRes.ok) {
  fail(`blockmap asset is missing (HTTP ${blockmapRes.status}) — differential updates broken`);
}
process.stdout.write('[feed] blockmap asset: present\n');

// the integrity loop: the sha512 the feed promises is the sha512 the bits have
const installer = await download(`${base}/releases/download/${tag}/${path}`);
const actual = createHash('sha512').update(installer).digest('base64');
if (actual !== sha512) {
  fail(`installer sha512 mismatch — feed says ${sha512}, bits hash to ${actual}`);
}
process.stdout.write(`[feed] installer sha512: verified (${installer.length} bytes)\n`);

process.stdout.write(`[feed] PASS — ${tag} serves a complete, verifiable update feed\n`);
