const fs = require('fs')
const path = require('path')
const { TextDecoder } = require('util')

const root = path.resolve(__dirname, '..')
const decoder1251 = new TextDecoder('windows-1251')
const decoderUtf8 = new TextDecoder('utf-8', { fatal: true })
const reverse1251 = new Map()

for (let byte = 0; byte < 256; byte += 1) {
  reverse1251.set(decoder1251.decode(Uint8Array.of(byte)), byte)
}

const markerCodes = new Set([
  0x00b0, 0x00b1, 0x00b5,
  0x0402, 0x0403, 0x0405, 0x0406, 0x0407, 0x040a, 0x040b, 0x040e, 0x040f,
  0x0452, 0x0453, 0x0459, 0x045a, 0x045c, 0x045f, 0x0490, 0x0491,
  0x201a, 0x201c, 0x201d, 0x201e, 0x2020, 0x2021, 0x2022, 0x2026,
  0x2030, 0x2039, 0x203a, 0x20ac, 0x2116, 0x2122,
])

function markerScore(value) {
  let score = 0
  for (const char of value) {
    if (markerCodes.has(char.charCodeAt(0))) score += 1
  }
  if (/Р[Ѐ-ӿ]|С[Ѐ-ӿ]|в[Ѐ-ӿ\u201a-\u2026\u20ac\u2122]|рџ|пё|Г[Ѐ-ӿ]|Д[Ѐ-ӿ]|Е[Ѐ-ӿ]/.test(value)) {
    score += 8
  }
  return score
}

function repairRun(value) {
  const before = markerScore(value)
  if (!before) return value

  const bytes = []
  for (const char of value) {
    const byte = reverse1251.get(char)
    if (byte === undefined) return value
    bytes.push(byte)
  }

  let decoded
  try {
    decoded = decoderUtf8.decode(Uint8Array.from(bytes))
  } catch {
    return value
  }

  return markerScore(decoded) < before ? decoded : value
}

function repairFile(file) {
  const fullPath = path.resolve(root, file)
  const content = fs.readFileSync(fullPath, 'utf8')
  const updated = content.replace(/[^\x00-\x7f]+/g, repairRun)
  if (updated !== content) {
    fs.writeFileSync(fullPath, updated, 'utf8')
    return true
  }
  return false
}

const files = process.argv.slice(2)
if (!files.length) {
  console.error('Usage: node scripts/repair-mojibake.js <file...>')
  process.exit(1)
}

for (const file of files) {
  if (repairFile(file)) console.log(file)
}
