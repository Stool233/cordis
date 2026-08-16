#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const manifestPath = join(repository, 'formal/observation-points.json')

const scanners = {
  'packages/core/src/fiber.ts': [
    ['lifecycle', /(?:public\s+state\s*=(?!=)|this\.state\s*=(?!=))/],
    ['uid', /this\.uid\s*=(?!=)/],
    ['epoch', /(?:\bepoch:\s*(?:INACTIVE|''|true)|(?:runner|this\._runner)\.epoch\s*=(?!=))/],
    ['target', /(?:private\s+_target[^=]*=|(?:delete\s+)?this\._store\[name\]\s*=|delete\s+this\._store\[name\]|this\._target\s*=)/],
    ['committed', /this\.store\s*=/],
    ['registry', /(?:runtime\.fibers\.push\(|^\s*remove\(\))/],
  ],
  'packages/core/src/reflect.ts': [
    ['service', /(?:public\s+store[^=]*=|this\.store\[key\]\s*=|this\.ctx\.fiber\.store!\[name\]\s*=|delete\s+this\.store\[key\]|delete\s+this\.ctx\.fiber\.store!\[name\])/],
  ],
  'packages/core/src/registry.ts': [
    ['registry', /this\._internal\.(?:set|delete)\(/],
  ],
}

function key(entry) {
  return `${entry.file}\u0000${entry.category}\u0000${entry.source}`
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
assert.equal(manifest.schema, 'cordis.paper-observation-points/v1')
const expected = new Map()
for (const entry of manifest.entries) {
  assert.ok(entry.observer, `missing observer for ${entry.file}: ${entry.source}`)
  const id = key(entry)
  assert.ok(!expected.has(id), `duplicate observation manifest entry: ${entry.file}: ${entry.source}`)
  expected.set(id, entry.occurrences)
}

const actual = new Map()
for (const [file, rules] of Object.entries(scanners)) {
  const lines = (await readFile(join(repository, file), 'utf8')).split('\n')
  for (const line of lines) {
    for (const [category, pattern] of rules) {
      if (!pattern.test(line)) continue
      const id = key({ file, category, source: line.trim() })
      actual.set(id, (actual.get(id) ?? 0) + 1)
    }
  }
}

const errors = []
for (const [id, count] of actual) {
  if (!expected.has(id)) {
    const [file, category, source] = id.split('\u0000')
    errors.push(`unobserved ${category} write in ${file}: ${source}`)
  } else if (expected.get(id) !== count) {
    errors.push(`write count changed for ${id.split('\u0000').join(': ')}: expected ${expected.get(id)}, found ${count}`)
  }
}
for (const [id, count] of expected) {
  if (!actual.has(id)) errors.push(`stale manifest entry (${count} occurrence(s)): ${id.split('\u0000').join(': ')}`)
}

if (errors.length) throw new Error(`Cordis paper trace observation coverage failed:\n${errors.map(error => `- ${error}`).join('\n')}`)
process.stdout.write(`observation coverage: ${manifest.entries.length} approved write points\n`)
