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
  if (id === '4004') return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('synthetic Graph timeout')), 12000)
    init.signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('synthetic Graph aborted')) }, { once: true })
  })
  if (id === '9981') await new Promise(resolve => setTimeout(resolve, 5000))
  if (['429', '995', '996'].includes(id) && count === 1) return new Response('{}', { status: 429, headers: { 'Retry-After': '0' } })
  if (id === '500' && count === 1) return new Response('{}', { status: 500 })
  if (id === '404') return new Response('{}', { status: 404 })
  return Response.json({ id, form_id: id === '997' ? '225' : id === '9981' ? '227' : '222',
    created_time: new Date(Date.now() - (id === '3002' ? 367 * 86400000 : 0)).toISOString(),
    platform: id === '334' ? 'instagram' : id === '555' ? 'mystery' : 'facebook',
    field_data: [{ name: 'full_name', values: [`Synthetic ${id}`] }, { name: 'email', values: [`synthetic-${id}@example.invalid`] }],
  })
}
