#!/usr/bin/env node
// Harness validation for the seo-stat development harness.
// Standard library only: no third-party dependencies.
//
// Checks:
//   1. Completed task records (tasks/TASK-*.md) contain every required section
//      and the four State fields.
//   2. Local Markdown links resolve to existing files or directories.
//
// Usage: node scripts/validate-harness.mjs

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', '.opencode']);

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

function main() {
  const files = walk(ROOT);
  const linkCount = checkMarkdownLinks(files);
  const { taskFiles, completed } = checkCompletedTasks(files);

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
}

main();
