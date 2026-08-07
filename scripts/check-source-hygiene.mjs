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

for (const file of sourceFiles) {
  const relative = path.relative(root, file);
  const content = await readFile(file, 'utf8');
  if (/\bdebugger\s*;?/.test(content)) failures.push(`${relative}: debugger statement is not allowed`);
  if (/\bconsole\.log\s*\(/.test(content)) failures.push(`${relative}: console.log is not allowed in production source`);
}

if (failures.length) {
  console.error('Source hygiene checks failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Source hygiene checks passed (${sourceFiles.length} production source files; direct dependencies are exactly pinned).`);
