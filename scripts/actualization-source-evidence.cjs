const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const cp = require('node:child_process')
const root = path.resolve(__dirname, '..')
function digest(dir) {
  const hash = crypto.createHash('sha256')
  function visit(folder) {
    for (const entry of fs
      .readdirSync(folder, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(folder, entry.name)
      if (entry.isDirectory()) visit(file)
      else {
        hash.update(path.relative(dir, file).replaceAll('\\', '/') + '\0')
        hash.update(fs.readFileSync(file))
        hash.update('\0')
      }
    }
  }
  visit(dir)
  return hash.digest('hex')
}
function sourceEvidence() {
  const sourceDigest = digest(path.join(root, 'src'))
  const copiedSourceDigest = digest(path.join(root, 'work/actualization-app/src'))
  if (sourceDigest !== copiedSourceDigest)
    throw Error('Copied application sources differ from feature sources')
  cp.execFileSync('git', ['diff', '--quiet', 'HEAD', '--', 'src'], { cwd: root })
  return {
    head: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    srcTree: cp
      .execFileSync('git', ['rev-parse', 'HEAD:src'], { cwd: root, encoding: 'utf8' })
      .trim(),
    sourceDigest,
    copiedSourceDigest,
  }
}
module.exports = { digest, sourceEvidence }
if (require.main === module) console.log(JSON.stringify(sourceEvidence(), null, 2))
