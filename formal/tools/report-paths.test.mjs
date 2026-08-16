import assert from 'node:assert/strict'
import { test } from 'node:test'
import { absolutePathAt, evidenceReference, portableCommand, resolveEvidenceReference } from './report-paths.mjs'

test('report references use output-relative POSIX paths', () => {
  assert.equal(evidenceReference('/study/evidence', '/study/evidence/traces/example.ndjson'), 'traces/example.ndjson')
  assert.equal(resolveEvidenceReference('/study/evidence', 'traces/example.ndjson'), '/study/evidence/traces/example.ndjson')
  assert.throws(() => resolveEvidenceReference('/study/evidence', '../outside.json'), /outside evidence output root/)
  assert.throws(() => resolveEvidenceReference('/study/evidence', 'C:\\outside.json'), /must be relative/)
  assert.throws(() => resolveEvidenceReference('/study/evidence', 'traces\\example.ndjson'), /POSIX separators/)
})

test('failure commands replace every machine-local root', () => {
  const command = portableCommand([
    'java',
    '-cp',
    '/cache/tools.jar:/cache/community.jar',
    '-metadir',
    '/evidence/tlc/model',
    '-config',
    '/checkout/formal/config/model.cfg',
    '/checkout/implementation/src/index.ts',
  ], {
    OUTPUT: '/evidence',
    FORMAL_ROOT: '/checkout/formal',
    IMPLEMENTATION_ROOT: '/checkout/implementation',
    TOOL_CACHE: '/cache',
  })
  assert.deepEqual(command, [
    'java',
    '-cp',
    '${TOOL_CACHE}/tools.jar:${TOOL_CACHE}/community.jar',
    '-metadir',
    '${OUTPUT}/tlc/model',
    '-config',
    '${FORMAL_ROOT}/config/model.cfg',
    '${IMPLEMENTATION_ROOT}/src/index.ts',
  ])
})

test('absolute path detection covers Unix and Windows reports', () => {
  assert.equal(absolutePathAt({ trace: 'traces/example.ndjson' }), null)
  assert.equal(absolutePathAt({ trace: '/tmp/example.ndjson' }), '$.trace')
  assert.equal(absolutePathAt({ command: ['java', 'C:\\tmp\\example.json'] }), '$.command[1]')
  assert.equal(absolutePathAt({ command: ['java', '\\\\server\\share\\example.json'] }), '$.command[1]')
  assert.equal(absolutePathAt({ command: ['java', 'tools.jar:/tmp/community.jar'] }), '$.command[1]')
  assert.equal(absolutePathAt({ command: ['java', 'C:\\tools.jar;D:\\community.jar'] }), '$.command[1]')
  assert.equal(absolutePathAt({ source: 'https://github.com/cordiverse/cordis' }), null)
})
