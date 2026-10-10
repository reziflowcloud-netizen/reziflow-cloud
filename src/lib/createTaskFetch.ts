const requestKeys = new Map<string, string>()
// Keep the request identity on a network failure, including a lost response
// after commit. A successful create ends that operation.
export async function createTaskFetch(options: RequestInit) {
  const identity = String(options.body || '')
  const key = requestKeys.get(identity) || crypto.randomUUID()
  requestKeys.set(identity, key)
  const headers = new Headers(options.headers)
  headers.set('X-LegalHub-Create-Request', key)
  const response = await fetch('/api/tasks', { ...options, headers })
  // Headers alone do not confirm success: the JSON body can be lost in transit.
  const created = response.ok ? await response.clone().json().catch(() => null) : null
  if (created?.id || (response.status >= 400 && response.status < 500)) requestKeys.delete(identity)
  return response
}
