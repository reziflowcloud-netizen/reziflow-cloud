export class BodyLimitError extends Error {}

// Count bytes while reading, not after buffering the complete remote body.
export async function readBoundedBody(body: ReadableStream<Uint8Array> | null, limit: number,
  contentLength: string | null = null): Promise<Uint8Array> {
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > limit) {
    await body?.cancel().catch(() => {})
    throw new BodyLimitError('BODY_TOO_LARGE')
  }
  if (!body) return new Uint8Array()
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.byteLength
      if (size > limit) {
        await reader.cancel().catch(() => {})
        throw new BodyLimitError('BODY_TOO_LARGE')
      }
      chunks.push(next.value)
    }
  } finally { reader.releaseLock() }
  const result = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength }
  return result
}
