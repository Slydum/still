import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const codeExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);
const exactVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (['node_modules', 'dist', '.tmp', '.git'].includes(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else files.push(fullPath);
  }
  return files;
}

const failures = [];
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
for (const section of ['dependencies', 'devDependencies']) {
  for (const [name, version] of Object.entries(packageJson[section] ?? {})) {
    if (!exactVersion.test(version)) {
      failures.push(`package.json: ${section}.${name} must use an exact version, found ${version}`);
    }
  }
}

const sourceFiles = (await walk(path.join(root, 'src')))
  .filter((file) => codeExtensions.has(path.extname(file)));
const retiredLegacyStorePath = path.join(root, 'src', 'stores', 'useAppStoreLegacy.ts');
if (sourceFiles.includes(retiredLegacyStorePath)) {
  failures.push('src/stores/useAppStoreLegacy.ts: retired Phase 4 runtime path must not be reintroduced');
}

for (const file of sourceFiles) {
  const relative = path.relative(root, file);
  const content = await readFile(file, 'utf8');
  if (/\bdebugger\s*;?/.test(content)) failures.push(`${relative}: debugger statement is not allowed`);
  if (/\bconsole\.log\s*\(/.test(content)) failures.push(`${relative}: console.log is not allowed in production source`);
  if (content.includes('useAppStoreLegacy')) {
    failures.push(`${relative}: imports or references the retired useAppStoreLegacy runtime path`);
  }

  const workRelated = relative.startsWith(`src${path.sep}features${path.sep}work${path.sep}`)
    || (relative.startsWith(`src${path.sep}theme${path.sep}`) && /work/i.test(path.basename(relative)));
  if (workRelated && /document\.createElement\(['"]style['"]\)/.test(content)) {
    failures.push(`${relative}: Work styles must ship as CSS, not runtime <style> injection`);
  }
}

if (failures.length) {
  console.error('Source hygiene checks failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Source hygiene checks passed (${sourceFiles.length} production source files; direct dependencies are exactly pinned).`);
