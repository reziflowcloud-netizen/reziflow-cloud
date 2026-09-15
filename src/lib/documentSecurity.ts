import path from 'path'

export const MAX_DOCUMENT_UPLOAD_BYTES = 150 * 1024 * 1024

export type ValidatedDocumentUpload = {
  extension: 'pdf' | 'png' | 'jpg' | 'gif' | 'webp'
  fileType: 'pdf' | 'image'
  mimeType: string
  resourceType: 'raw' | 'image'
}

export class DocumentValidationError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'DocumentValidationError'
    this.status = status
  }
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value)
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  let value = ''
  for (let index = start; index < Math.min(bytes.length, start + length); index += 1) {
    value += String.fromCharCode(bytes[index])
  }
  return value
}

function normalizedExtension(name: string) {
  const extension = path.extname(name || '').toLowerCase().replace(/^\./, '')
  return extension === 'jpeg' ? 'jpg' : extension
}

function detectedType(bytes: Uint8Array): ValidatedDocumentUpload['extension'] | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'pdf'
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpg'
  if (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a') return 'gif'
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'webp'
  return null
}

const MIME_BY_EXTENSION: Record<ValidatedDocumentUpload['extension'], string[]> = {
  pdf: ['application/pdf'],
  png: ['image/png'],
  jpg: ['image/jpeg', 'image/jpg'],
  gif: ['image/gif'],
  webp: ['image/webp'],
}

export function validateDocumentUpload(input: {
  bytes: Uint8Array
  declaredMime: string
  declaredSize: number
  name: string
}): ValidatedDocumentUpload {
  const actualSize = input.bytes.byteLength
  if (!actualSize) throw new DocumentValidationError('Empty files are not allowed')
  if (actualSize > MAX_DOCUMENT_UPLOAD_BYTES || input.declaredSize > MAX_DOCUMENT_UPLOAD_BYTES) {
    throw new DocumentValidationError('File is too large. Maximum size is 150 MB.', 413)
  }
  if (input.declaredSize !== actualSize) {
    throw new DocumentValidationError('File size does not match the uploaded content')
  }

  const detected = detectedType(input.bytes)
  if (!detected) {
    throw new DocumentValidationError('Unsupported document content. Upload PDF, PNG, JPEG, GIF or WebP files only.')
  }

  const extension = normalizedExtension(input.name)
  if (extension !== detected) {
    throw new DocumentValidationError('File extension does not match the uploaded content')
  }

  const declaredMime = String(input.declaredMime || '').trim().toLowerCase()
  if (!MIME_BY_EXTENSION[detected].includes(declaredMime)) {
    throw new DocumentValidationError('File MIME type does not match the uploaded content')
  }

  return {
    extension: detected,
    fileType: detected === 'pdf' ? 'pdf' : 'image',
    mimeType: MIME_BY_EXTENSION[detected][0],
    resourceType: detected === 'pdf' ? 'raw' : 'image',
  }
}

export function isApprovedCloudinaryUrl(value: unknown, cloudName: string | undefined): boolean {
  if (typeof value !== 'string' || !cloudName) return false
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || url.port || url.username || url.password) {
      return false
    }
    const [firstSegment] = url.pathname.split('/').filter(Boolean)
    return firstSegment === cloudName
  } catch {
    return false
  }
}

export function resolveLocalDocumentPath(publicRoot: string, publicId: unknown): string {
  const value = typeof publicId === 'string' ? publicId : ''
  if (!value.startsWith('local:')) throw new DocumentValidationError('Not a local document path')

  const raw = value.slice('local:'.length).trim()
  if (!raw || raw.startsWith('/') || raw.startsWith('\\') || /^[a-zA-Z]:[\\/]/.test(raw)) {
    throw new DocumentValidationError('Invalid local document path')
  }

  const normalizedInput = raw.replace(/[\\/]+/g, path.sep)
  const approvedRoot = path.resolve(publicRoot)
  const resolved = path.resolve(approvedRoot, normalizedInput)
  const relative = path.relative(approvedRoot, resolved)
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new DocumentValidationError('Document path escapes the approved storage directory')
  }
  return resolved
}

export function privateDocumentUrl(documentId: number | string) {
  return `/api/documents/${encodeURIComponent(String(documentId))}/file`
}

export function serializeDocumentForBrowser<T extends Record<string, any>>(document: T) {
  const {
    publicId: _publicId,
    storageId: _storageId,
    storagePath: _storagePath,
    dropboxStorageId: _dropboxStorageId,
    dropboxPath: _dropboxPath,
    dropboxSyncError: _dropboxSyncError,
    url: _providerUrl,
    ...safe
  } = document

  return {
    ...safe,
    url: privateDocumentUrl(document.id),
  }
}
