// src/lib/auth.ts
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

function jwtSecret() {
  const value = process.env.JWT_SECRET?.trim()
  if (!value) throw new Error('JWT_SECRET is required')
  return new TextEncoder().encode(value)
}

export async function signToken(payload: Record<string, unknown>, expiresIn: string | number = '7d') {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(expiresIn)
    .sign(jwtSecret())
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, jwtSecret())
    return payload
  } catch {
    return null
  }
}

export async function getUser() {
  const cookieStore = cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null
  return verifyToken(token)
}

export function getOrganizationId(user: any) {
  return String(user?.organizationId || 'org_default')
}

export async function requireAuth() {
  const user = await getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}
