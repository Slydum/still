import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const blockingSeverities = new Set(['high', 'critical']);
const rscException = {
  advisory: 'GHSA-qwww-vcr4-c8h2',
  packageName: 'react-router',
  routerDomVersion: '7.18.2',
  rationale: 'This reviewed advisory affects only unstable React Router RSC APIs; Still is a client-side BrowserRouter SPA and does not use those APIs.',
};

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else if (/\.(?:ts|tsx|js|mjs|cjs)$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const sourceFiles = await walk(path.join(root, 'src'));
const rscSignals = [
  /unstable_RSC/,
  /RSCHydratedRouter/,
  /RSCStaticRouter/,
  /createCallServer/,
  /react-router\/dom\/server/,
  /react-router\/server/,
  /react-server-dom-/,
];
const rscUsages = [];
for (const file of sourceFiles) {
  const content = await readFile(file, 'utf8');
  for (const signal of rscSignals) {
    if (signal.test(content)) {
      rscUsages.push(`${path.relative(root, file)} matches ${signal}`);
      break;
    }
  }
}

const rscExceptionEnabled =
  packageJson.dependencies?.['react-router-dom'] === rscException.routerDomVersion &&
  rscUsages.length === 0;

const audit = spawnSync('npm', ['audit', '--json', '--audit-level=high'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
});

if (audit.error) {
  console.error('Could not execute npm audit:', audit.error);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(audit.stdout || '{}');
} catch (error) {
  console.error('npm audit did not return valid JSON.');
  if (audit.stdout) console.error(audit.stdout);
  if (audit.stderr) console.error(audit.stderr);
  console.error(error);
  process.exit(1);
}

if (report.error) {
  console.error('npm audit failed:', report.error.summary ?? report.error.message ?? report.error);
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities ?? {};
const memo = new Map();
const allowedAdvisories = new Set();

function advisoryId(via) {
  const text = `${via?.url ?? ''} ${via?.source ?? ''} ${via?.title ?? ''}`;
  return text.match(/GHSA-[0-9A-Za-z-]+/)?.[0] ?? '';
}

function inspectVulnerability(name, visiting = new Set()) {
  if (memo.has(name)) return memo.get(name);
  if (visiting.has(name)) return { blocking: [`${name}: cyclic audit dependency could not be resolved safely`], allowed: [] };

  const vulnerability = vulnerabilities[name];
  if (!vulnerability || !blockingSeverities.has(vulnerability.severity)) {
    const result = { blocking: [], allowed: [] };
    memo.set(name, result);
    return result;
  }

  const nextVisiting = new Set(visiting).add(name);
  const blocking = [];
  const allowed = [];
  const via = Array.isArray(vulnerability.via) ? vulnerability.via : [];

  if (via.length === 0) blocking.push(`${name}: ${vulnerability.severity} vulnerability has no advisory detail`);

  for (const reason of via) {
    if (typeof reason === 'string') {
      const nested = inspectVulnerability(reason, nextVisiting);
      blocking.push(...nested.blocking);
      allowed.push(...nested.allowed);
      continue;
    }

    if (!blockingSeverities.has(reason?.severity)) continue;
    const ghsa = advisoryId(reason);
    if (
      name === rscException.packageName &&
      ghsa === rscException.advisory &&
      rscExceptionEnabled
    ) {
      allowed.push(`${name}: ${ghsa} — ${reason.title ?? rscException.rationale}`);
      allowedAdvisories.add(ghsa);
      continue;
    }

    blocking.push(`${name}: ${ghsa || reason?.title || 'high/critical advisory'}${reason?.url ? ` (${reason.url})` : ''}`);
  }

  const result = { blocking: [...new Set(blocking)], allowed: [...new Set(allowed)] };
  memo.set(name, result);
  return result;
}

const blocking = [];
for (const [name, vulnerability] of Object.entries(vulnerabilities)) {
  if (!blockingSeverities.has(vulnerability?.severity)) continue;
  blocking.push(...inspectVulnerability(name).blocking);
}

if (blocking.length > 0) {
  console.error('Dependency audit found blocking high/critical vulnerabilities:');
  for (const issue of [...new Set(blocking)]) console.error(`- ${issue}`);
  if (!rscExceptionEnabled && vulnerabilities[rscException.packageName]) {
    console.error(`- The ${rscException.advisory} exception is disabled.`);
    if (packageJson.dependencies?.['react-router-dom'] !== rscException.routerDomVersion) {
      console.error(`  react-router-dom must be exactly ${rscException.routerDomVersion}.`);
    }
    for (const usage of rscUsages) console.error(`  RSC signal: ${usage}`);
  }
  process.exit(1);
}

if (allowedAdvisories.size > 0) {
  console.log(`Dependency audit passed with one scoped exception: ${[...allowedAdvisories].join(', ')}.`);
  console.log(rscException.rationale);
  console.log('Any RSC API usage or any other high/critical advisory will fail this gate.');
} else {
  console.log('Dependency audit passed with no high or critical vulnerabilities.');
}
