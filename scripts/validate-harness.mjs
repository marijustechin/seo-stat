#!/usr/bin/env node
// Harness validation for the seo-stat development harness.
// Standard library only: no third-party dependencies.
//
// Checks:
//   1. Completed task records (tasks/TASK-*.md) contain every required section
//      and the four State fields.
//   2. Local Markdown links resolve to existing files or directories.
//   3. Confirmed architecture rules: pinned major versions, ESM configuration,
//      and the required ports.
//
// Usage: node scripts/validate-harness.mjs

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', '.opencode', '.next', 'dist', 'coverage']);

const REQUIRED_TASK_SECTIONS = [
  'Objective',
  'Scope',
  'Acceptance criteria',
  'Verification evidence',
  'Completion notes',
  'State',
];

const REQUIRED_STATE_FIELDS = ['Implementation', 'Verification', 'Commit', 'Deployment'];

const errors = [];

function rel(file) {
  return relative(ROOT, file).split(sep).join('/');
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function walk(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      found.push(...walk(join(dir, entry.name)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      found.push(join(dir, entry.name));
    }
  }
  return found;
}

const FENCE = /```[\s\S]*?```/g;
const LINK = /!?\[[^\]]*\]\(([^)]+)\)/g;

function checkMarkdownLinks(files) {
  let checked = 0;
  for (const file of files) {
    const raw = readFileSync(file, 'utf8').replace(FENCE, '');
    const lines = raw.split(/\r?\n/);
    lines.forEach((line, index) => {
      LINK.lastIndex = 0;
      let match;
      while ((match = LINK.exec(line)) !== null) {
        let target = match[1].trim();
        if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1);
        target = target.split(/\s+/)[0];
        if (!target) continue;
        if (/^(https?:)?\/\//i.test(target)) continue;
        if (/^(mailto:|tel:|data:|#)/i.test(target)) continue;
        const pathPart = decodeURIComponent(target.split('#')[0].split('?')[0]);
        if (!pathPart) continue;
        checked += 1;
        const abs = resolve(dirname(file), pathPart);
        if (!existsSync(abs)) {
          errors.push(`${rel(file)}:${index + 1} broken local link -> ${target}`);
        }
      }
    });
  }
  return checked;
}

function checkCompletedTasks(files) {
  const taskFiles = files.filter((file) => /[\\/]tasks[\\/]TASK-.*\.md$/i.test(file));
  let completed = 0;
  for (const file of taskFiles) {
    const text = readFileSync(file, 'utf8');
    const statusMatch = text.match(/^\s*[-*]?\s*State:\s*([A-Za-z_-]+)/im);
    const status = statusMatch ? statusMatch[1].toLowerCase() : '';
    if (status !== 'completed') continue;
    completed += 1;
    for (const section of REQUIRED_TASK_SECTIONS) {
      const re = new RegExp(`^#{2,3}\\s+${escapeRegExp(section)}\\b`, 'im');
      if (!re.test(text)) {
        errors.push(`${rel(file)}: completed task missing section "## ${section}"`);
      }
    }
    for (const field of REQUIRED_STATE_FIELDS) {
      const re = new RegExp(`\\b${escapeRegExp(field)}:`, 'i');
      if (!re.test(text)) {
        errors.push(`${rel(file)}: completed task missing state field "${field}:"`);
      }
    }
  }
  return { taskFiles: taskFiles.length, completed };
}

function readJson(relPath) {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs)) {
    errors.push(`missing required file ${relPath}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(abs, 'utf8'));
  } catch (error) {
    errors.push(`invalid JSON in ${relPath}: ${error.message}`);
    return null;
  }
}

function readText(relPath) {
  const abs = join(ROOT, relPath);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : '';
}

function major(version) {
  const match = String(version).match(/(\d+)/);
  return match ? Number(match[1]) : Number.NaN;
}

// Confirmed architecture rules (see AGENTS.md). These are authoritative: agents
// must not reopen them without an explicit user decision.
function checkProjectRules() {
  const rootPkg = readJson('package.json');
  const apiPkg = readJson('apps/api/package.json');
  const webPkg = readJson('apps/web/package.json');
  const apiTs = readJson('apps/api/tsconfig.json');

  if (rootPkg && !String(rootPkg.packageManager ?? '').startsWith('pnpm@11.')) {
    errors.push('package.json: packageManager must pin pnpm 11');
  }
  if (rootPkg && !String(rootPkg.engines?.node ?? '').includes('24')) {
    errors.push('package.json: engines.node must require Node 24');
  }

  // ESM for all project-owned code and configuration.
  if (apiPkg && apiPkg.type !== 'module') {
    errors.push('apps/api/package.json: "type" must be "module" (ESM)');
  }
  if (webPkg && webPkg.type !== 'module') {
    errors.push('apps/web/package.json: "type" must be "module" (ESM)');
  }
  if (apiTs && apiTs.compilerOptions?.module !== 'nodenext') {
    errors.push('apps/api/tsconfig.json: compilerOptions.module must be "nodenext"');
  }
  if (apiTs && apiTs.compilerOptions?.emitDecoratorMetadata !== true) {
    errors.push('apps/api/tsconfig.json: compilerOptions.emitDecoratorMetadata must be true');
  }

  const checkMajor = (pkg, file, dep, section, expected) => {
    const version = pkg?.[section]?.[dep];
    if (!version) {
      errors.push(`${file}: missing dependency ${dep} in ${section}`);
    } else if (major(version) !== expected) {
      errors.push(`${file}: ${dep} must be major ${expected} (found ${version})`);
    }
  };
  checkMajor(apiPkg, 'apps/api/package.json', '@nestjs/core', 'dependencies', 12);
  checkMajor(apiPkg, 'apps/api/package.json', '@nestjs/platform-fastify', 'dependencies', 12);
  checkMajor(apiPkg, 'apps/api/package.json', '@prisma/client', 'dependencies', 7);
  checkMajor(apiPkg, 'apps/api/package.json', '@prisma/adapter-pg', 'dependencies', 7);
  checkMajor(webPkg, 'apps/web/package.json', 'next', 'dependencies', 16);
  checkMajor(webPkg, 'apps/web/package.json', 'react', 'dependencies', 19);

  for (const legacy of [
    'apps/api/jest.config.js',
    'apps/api/test/jest-e2e.json',
    'apps/web/jest.config.js',
  ]) {
    if (existsSync(join(ROOT, legacy))) {
      errors.push(`${legacy}: legacy CommonJS test config must not exist (use Vitest)`);
    }
  }

  // Required ports: API 3011, frontend 3012.
  if (!readText('apps/api/.env.example').includes('PORT=3011')) {
    errors.push('apps/api/.env.example: must set PORT=3011');
  }
  if (!String(apiPkg?.scripts?.start ?? '').includes('dist/main.js')) {
    errors.push('apps/api/package.json: start must run the built ESM entry (dist/main.js)');
  }
  if (!String(webPkg?.scripts?.dev ?? '').includes('3012')) {
    errors.push('apps/web/package.json: dev must run on port 3012');
  }
  if (!String(webPkg?.scripts?.start ?? '').includes('3012')) {
    errors.push('apps/web/package.json: start must run on port 3012');
  }
  if (!readText('apps/web/next.config.mjs').includes('3011')) {
    errors.push('apps/web/next.config.mjs: API proxy target must default to port 3011');
  }
  if (!readText('scripts/smoke-subpath.mjs').includes('3012')) {
    errors.push('scripts/smoke-subpath.mjs: default base URL must use port 3012');
  }
}

function main() {
  const files = walk(ROOT);
  const linkCount = checkMarkdownLinks(files);
  const { taskFiles, completed } = checkCompletedTasks(files);
  checkProjectRules();

  if (errors.length > 0) {
    console.error('Harness validation FAILED:');
    for (const error of errors) console.error(`  - ${error}`);
    console.error(`\n${errors.length} problem(s) found.`);
    process.exit(1);
  }

  console.log('Harness validation passed.');
  console.log(`  Markdown files scanned: ${files.length}`);
  console.log(`  Local links checked:    ${linkCount}`);
  console.log(`  Task records found:     ${taskFiles} (${completed} completed)`);
  console.log('  Project rules:          versions, ESM, ports OK');
}

main();
