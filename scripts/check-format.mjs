import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const roots = ['src', 'tests', 'scripts', 'supabase', '.github', 'public'];
const textExtensions = new Set([
  '.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.yml', '.yaml', '.md', '.sql', '.toml', '.css', '.html', '.webmanifest',
]);
const rootFiles = ['package.json', 'tsconfig.json', 'tsconfig.test.json', 'vite.config.ts', 'vercel.json', 'IMPLEMENTATION_NOTES.md', 'PHONE_TERMINAL_INSTALL.md'];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (['node_modules', 'dist', '.tmp', '.git'].includes(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else if (textExtensions.has(path.extname(entry.name))) files.push(fullPath);
  }
  return files;
}

const files = [];
for (const directory of roots) files.push(...await walk(path.join(root, directory)));
for (const file of rootFiles) files.push(path.join(root, file));

const failures = [];
for (const file of [...new Set(files)]) {
  const relative = path.relative(root, file);
  const content = await readFile(file, 'utf8');
  if (content.length && !content.endsWith('\n')) failures.push(`${relative}: missing final newline`);
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (/[ \t]+$/.test(line)) failures.push(`${relative}:${index + 1}: trailing whitespace`);
  });
  if (path.extname(file) === '.json') {
    try {
      JSON.parse(content);
    } catch (error) {
      failures.push(`${relative}: invalid JSON (${error instanceof Error ? error.message : String(error)})`);
    }
  }
}

if (failures.length) {
  console.error('Formatting checks failed:');
  for (const failure of failures.slice(0, 100)) console.error(`- ${failure}`);
  if (failures.length > 100) console.error(`- ...and ${failures.length - 100} more`);
  process.exit(1);
}

console.log(`Formatting baseline passed for ${new Set(files).size} text files.`);
