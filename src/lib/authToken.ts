import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

function jwtSecret() {
  const value = process.env.JWT_SECRET?.trim()
  if (!value) throw new Error('JWT_SECRET is required')
  return new TextEncoder().encode(value)
}

export async function signToken(payload: Record<string, unknown>, expiresIn: string | number = '7d') {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(jwtSecret())
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret())
    return payload
  } catch {
    return null
  }
}

export function tokenSessionVersion(payload: JWTPayload | Record<string, unknown>) {
  const value = Number(payload.sessionVersion ?? 0)
  return Number.isInteger(value) && value >= 0 ? value : -1
}

export function isSessionVersionCurrent(
  payload: JWTPayload | Record<string, unknown>,
  currentSessionVersion: number,
) {
  return tokenSessionVersion(payload) === currentSessionVersion
}
