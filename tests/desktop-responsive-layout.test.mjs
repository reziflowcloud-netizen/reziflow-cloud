import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'

const workspace = resolve(import.meta.dirname, '..')

async function source(path) {
  return readFile(resolve(workspace, path), 'utf8')
}

test('desktop Leads filters shrink before wrapping and right-align secondary controls', async () => {
  const page = await source('src/app/leads/page.tsx')

  assert.match(page, /@media \(min-width: 769px\)/)
  assert.match(page, /grid-template-columns: minmax\(150px, 1\.35fr\) repeat\(3, minmax\(0, 1fr\)\)/)
  assert.match(page, /\.lead-staff-scope-control \{ grid-column: 2; grid-row: 2; \}/)
  assert.match(page, /\.lead-columns-control \{ grid-column: 3; grid-row: 2; \}/)
  assert.match(page, /\.lead-view-toggle \{ grid-column: 4; grid-row: 2; \}/)
  assert.match(page, /className="lead-staff-scope-control"/)
  assert.match(page, /@media \(min-width: 1260px\)/)
  assert.doesNotMatch(page, /repeat\(auto-fit, minmax\(190px, 1fr\)\)/)
})

test('desktop Leads uses one collapsed-value Responsible dropdown without changing mobile usage', async () => {
  const [page, control, mobile] = await Promise.all([
    source('src/app/leads/page.tsx'),
    source('src/components/StaffScopeControl.tsx'),
    source('src/app/leads/LeadsMobile.tsx'),
  ])

  assert.match(page, /lang=\{lang\} collapsedValueLabel/)
  assert.match(control, /effectiveValue === 'all'\s*\? copy\.label/)
  assert.match(control, /effectiveValue === 'mine'\s*\? copy\.mine/)
  assert.match(control, /selectedEmployee\?\.name \|\| copy\.label/)
  assert.match(control, /<option value="all">\{copy\.all\}<\/option>/)
  assert.match(control, /data-staff-scope-control="collapsed"/)
  assert.doesNotMatch(mobile, /collapsedValueLabel/)
})

test('Dashboard desktop grids can shrink and only stack charts at the narrow desktop breakpoint', async () => {
  const [layout, css] = await Promise.all([
    source('src/app/dashboard/layout.tsx'),
    source('src/app/dashboard/DashboardMobile.module.css'),
  ])

  assert.match(layout, /style=\{\{ flex: 1, minWidth: 0 \}\}/)
  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/)
  assert.match(css, /dashboard-chart-grid[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(css, /@media \(min-width: 769px\) and \(max-width: 900px\)[\s\S]*dashboard-chart-grid[\s\S]*grid-template-columns: minmax\(0, 1fr\)/)
  assert.doesNotMatch(css.slice(0, css.indexOf('@media (max-width: 768px)')), /overflow-x:\s*hidden/)
})

test('Upcoming Events desktop rows shrink instead of widening the page', async () => {
  const upcoming = await source('src/components/UpcomingEvents.tsx')

  assert.match(upcoming, /\.upcoming-item \{\s*min-width: 0;\s*max-width: 100%;/)
  assert.match(upcoming, /\.upcoming-desktop-list,[\s\S]*\.upcoming-title,[\s\S]*\.upcoming-meta \{\s*min-width: 0;/)
  assert.match(upcoming, /\.upcoming-meta \{\s*flex-shrink: 1 !important;/)
})
