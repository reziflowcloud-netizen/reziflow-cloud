import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'

const workspace = resolve(import.meta.dirname, '..')

async function source(path) {
  return readFile(resolve(workspace, path), 'utf8')
}

test('migration adds only the nullable Case personal appearance note column', async () => {
  const migration = await source('prisma/migrations/20260924113000_case_personal_appearance_note/migration.sql')

  assert.match(migration, /^-- AlterTable\s+ALTER TABLE "Case" ADD COLUMN "personalAppearanceNote" TEXT;\s*$/)
  assert.doesNotMatch(migration, /NOT NULL|DEFAULT|UPDATE|DELETE|INSERT|DROP/i)
})

test('Case API keeps the existing tenant guard and persists create, edit, and clear through the same PATCH flow', async () => {
  const route = await source('src/app/api/cases/[id]/route.ts')

  assert.match(route, /caseWhereForScope\(scope, organizationId, \{ id: params\.id \}\)/)
  assert.match(route, /if \(has\('personalAppearanceNote'\)\) baseData\.personalAppearanceNote = nullableText\('personalAppearanceNote'\)/)
  assert.match(route, /String\(body\[key\] \|\| ''\)\.trim\(\) \|\| null/)
  assert.match(route, /data: \{ \.\.\.baseData, \.\.\.caseDetailsData \}/)
})

test('Case load and shared save form round-trip personalAppearanceNote without separate business logic', async () => {
  const page = await source('src/app/cases/[id]/page.tsx')

  assert.match(page, /personalAppearanceNote: data\.personalAppearanceNote \|\| ''/)
  assert.match(page, /body: JSON\.stringify\(\{ \.\.\.form,/)
  assert.match(page, /value=\{form\.personalAppearanceNote \|\| ''\}/)
  assert.match(page, /set\('personalAppearanceNote', e\.target\.value\)/)
})

test('desktop and mobile place the full-width note between personal appearance and card pickup', async () => {
  const [page, mobile] = await Promise.all([
    source('src/app/cases/[id]/page.tsx'),
    source('src/app/cases/[id]/CaseDetailMobile.tsx'),
  ])

  for (const markup of [page, mobile]) {
    const location = markup.indexOf("personal_visit_location")
    const note = markup.indexOf("personal_visit_note", location)
    const pickup = markup.indexOf("card_pickup_date", note)
    assert.ok(location >= 0 && note > location && pickup > note)
  }
  assert.match(mobile, /className=\{styles\.fullField\}>\{props\.t\('personal_visit_note'\)\}/)
})

test('RU, UA, and PL labels and placeholders are present', async () => {
  const translations = await source('src/lib/translations.ts')

  assert.match(translations, /personal_visit_note: 'Примечание к личной явке'/)
  assert.match(translations, /personal_visit_note_placeholder: 'Номер письма, талона или другое примечание\.\.\.'/)
  assert.match(translations, /personal_visit_note: 'Примітка до особистої явки'/)
  assert.match(translations, /personal_visit_note_placeholder: 'Номер листа, талона або інша примітка\.\.\.'/)
  assert.match(translations, /personal_visit_note: 'Notatka dotycząca osobistej wizyty'/)
  assert.match(translations, /personal_visit_note_placeholder: 'Numer pisma, talonu lub inna notatka\.\.\.'/)
})
