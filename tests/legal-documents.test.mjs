import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
const loaded = new Map()
function sourceModule(path) {
  if (loaded.has(path)) return loaded.get(path)
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }, reportDiagnostics: true })
  assert.equal((compiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0)
  const module = { exports: {} }
  const resolve = name => name === '@/components/LegalDocument'
    ? sourceModule('src/components/LegalDocument.tsx')
    : name === '@/lib/legalDocuments' ? sourceModule('src/lib/legalDocuments.ts') : require(name)
  new Function('require', 'module', 'exports', compiled.outputText)(resolve, module, module.exports)
  loaded.set(path, module.exports)
  return module.exports
}

for (const [route, title] of [['privacy', 'Privacy Policy'], ['data-deletion', 'Data Deletion Instructions'], ['regulamin', 'Regulamin LegalHub CRM']]) {
  test(`${route}: actual server component renders the public document and links without auth/data access`, () => {
    const Page = sourceModule(`src/app/${route}/page.tsx`).default
    const html = renderToStaticMarkup(React.createElement(Page))
    assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1)
    assert.ok(html.includes(title))
    assert.match(html, /office@legalhubcrm\.com/)
    assert.match(html, /1627116975561049/)
    assert.match(html, /href="\/privacy"|href="\/data-deletion"/)
    assert.doesNotMatch(html, /<form|type="password"|NEXT_PUBLIC_META|access_token=/i)
    assert.doesNotMatch(html, /\bSL\b|\bRAM\b/)
    assert.doesNotMatch(html, /stored primarily on servers located within the European Economic Area|Integration tokens are stored as organization settings/)
  })
}

test('shared renderer escapes text and never interprets document content as HTML', () => {
  const Component = sourceModule('src/components/LegalDocument.tsx').default
  const html = renderToStaticMarkup(React.createElement(Component, { document: {
    title: '<img src=x onerror=alert(1)>', updatedAt: 'draft',
    sections: [{ heading: 'A', paragraphs: ['<script>alert(1)</script>'] }],
  } }))
  assert.doesNotMatch(html, /<script>|<img/)
  assert.ok(html.includes('&lt;script&gt;'))
})
