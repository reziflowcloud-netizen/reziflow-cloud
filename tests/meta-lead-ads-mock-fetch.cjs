// Loaded only by the synthetic localhost HTTP suite. Never used in application code.
const actualFetch = global.fetch
const attempts = new Map()
global.fetch = async function syntheticMetaFetch(input, init) {
  const url = new URL(input instanceof URL || typeof input === 'string' ? input : input.url)
  if (url.hostname !== 'graph.facebook.com') return actualFetch(input, init)
  if (url.protocol !== 'https:' || !/^\/v\d+\.\d+\/[0-9]+$/.test(url.pathname)) throw new Error('Unexpected Graph request')
  const id = url.pathname.split('/').pop()
  const count = (attempts.get(id) || 0) + 1
  attempts.set(id, count)
  if (id === '429' && count === 1) return new Response('{}', { status: 429, headers: { 'Retry-After': '0' } })
  if (id === '500' && count === 1) return new Response('{}', { status: 500 })
  if (id === '404') return new Response('{}', { status: 404 })
  return Response.json({ id, form_id: '222', platform: id === '334' ? 'instagram' : id === '555' ? 'mystery' : 'facebook',
    field_data: [{ name: 'full_name', values: [`Synthetic ${id}`] }, { name: 'email', values: [`synthetic-${id}@example.invalid`] }],
  })
}
