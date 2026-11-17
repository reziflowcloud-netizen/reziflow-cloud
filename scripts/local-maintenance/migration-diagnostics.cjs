const PREFIX = 'GUARDED_MIGRATION_DIAGNOSTIC '
const CAPTURE_BYTES = 64 * 1024
const PROCESS_ERRORS = new Set(['ENOENT', 'EACCES', 'EPERM', 'ENOBUFS', 'ETIMEDOUT'])

function summarizeMigrationResult(result) {
  // Raw subprocess text stays in memory and is never returned or persisted.
  const text = [result.stdout, result.stderr]
    .map((value) => typeof value === 'string' ? value.slice(0, CAPTURE_BYTES) : '')
    .join('\n')
  const prismaCodes = [...new Set([...text.matchAll(/(?:Error(?: code)?\s*:\s*|error_code["']?\s*[:=]\s*["']?)(P[0-9]{4})\b/gi)]
    .map((match) => match[1].toUpperCase()))].slice(0, 4)
  const sqlstates = [...new Set([...text.matchAll(/(?:SQLSTATE|Database error code)\s*[:=]\s*["']?([0-9A-Z]{5})\b/g)]
    .map((match) => match[1]))].slice(0, 4)
  const processError = PROCESS_ERRORS.has(result.error?.code) ? result.error.code : null
  const exitCode = !result.error && Number.isInteger(result.status) && result.status >= 0 && result.status <= 255 ? result.status : 1
  let category = exitCode === 0 ? 'NONE' : 'UNCLASSIFIED_FAILURE'
  if (processError === 'ENOBUFS') category = 'OUTPUT_LIMIT'
  else if (processError === 'ETIMEDOUT') category = 'TIMEOUT'
  else if (processError || result.error) category = 'PROCESS_START'
  else if (prismaCodes.includes('P1011')) category = 'TLS'
  else if (prismaCodes.includes('P1000')) category = 'AUTHENTICATION'
  else if (prismaCodes.some((code) => ['P1001', 'P1017'].includes(code))) category = 'CONNECTION'
  else if (prismaCodes.some((code) => ['P1002', 'P1008'].includes(code)) || sqlstates.includes('57014')) category = 'TIMEOUT'
  else if (prismaCodes.includes('P1010') || sqlstates.includes('42501')) category = 'PERMISSION'
  else if (prismaCodes.some((code) => ['P1012', 'P1013'].includes(code))) category = 'CONFIGURATION'
  else if (prismaCodes.length || sqlstates.length) category = 'DATABASE_OR_MIGRATION_STATE'
  return { version: 1, exitCode, category, prismaCodes, sqlstates, processError, outputLimited: processError === 'ENOBUFS' }
}

function guardRefusalDiagnostic() {
  return { version: 1, exitCode: 1, category: 'ENTRYPOINT_GUARD', prismaCodes: [], sqlstates: [], processError: null, outputLimited: false }
}

module.exports = { PREFIX, CAPTURE_BYTES, summarizeMigrationResult, guardRefusalDiagnostic }
