import assert from 'node:assert/strict'
import { isAbsolute, relative, resolve, sep } from 'node:path'

const windowsAbsolute = /^(?:[A-Za-z]:[\\/]|\\\\)/
const embeddedUnixAbsolute = /(?:^|[:=;\s])\/(?!\/)/
const embeddedWindowsAbsolute = /(?:^|[=;\s])(?:[A-Za-z]:[\\/]|\\\\)/

function portableSeparators(value) {
  return value.split(sep).join('/')
}

/** Return a POSIX path relative to an evidence output root. */
export function evidenceReference(outputRoot, target) {
  const reference = relative(resolve(outputRoot), resolve(target))
  assert.ok(reference && reference !== '..' && !reference.startsWith(`..${sep}`) && !isAbsolute(reference), `${target} is outside evidence output root ${outputRoot}`)
  return portableSeparators(reference)
}

/** Resolve a report v1 file reference without permitting an output-root escape. */
export function resolveEvidenceReference(outputRoot, reference) {
  assert.equal(typeof reference, 'string', 'evidence file reference must be a string')
  assert.ok(reference.length > 0, 'evidence file reference must not be empty')
  assert.ok(!isAbsolute(reference) && !windowsAbsolute.test(reference), `evidence file reference must be relative: ${reference}`)
  assert.ok(!reference.includes('\\'), `evidence file reference must use POSIX separators: ${reference}`)
  const target = resolve(outputRoot, ...reference.split('/'))
  evidenceReference(outputRoot, target)
  return target
}

/** Replace machine-local command paths with stable evidence placeholders. */
export function portableCommand(command, roots) {
  const replacements = Object.entries(roots)
    .flatMap(([name, values]) => (Array.isArray(values) ? values : [values])
      .filter(value => typeof value === 'string' && value.length > 0)
      .flatMap(value => {
        const variants = new Set([value, value.replaceAll('\\', '/'), value.replaceAll('/', '\\')])
        return [...variants].map(variant => ({ name, value: variant }))
      }))
    .sort((left, right) => right.value.length - left.value.length)
  return command.map(argument => {
    let result = argument
    for (const replacement of replacements) result = result.replaceAll(replacement.value, `\${${replacement.name}}`)
    return result
  })
}

/** Detect absolute filesystem paths in serialized evidence values. */
export function absolutePathAt(value, location = '$') {
  if (typeof value === 'string') {
    return isAbsolute(value) || windowsAbsolute.test(value) || embeddedUnixAbsolute.test(value) || embeddedWindowsAbsolute.test(value) ? location : null
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      const found = absolutePathAt(value[index], `${location}[${index}]`)
      if (found) return found
    }
    return null
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      const found = absolutePathAt(item, `${location}.${key}`)
      if (found) return found
    }
  }
  return null
}
