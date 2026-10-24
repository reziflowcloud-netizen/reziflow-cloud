import { createHmac } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
const audience = 'legalhub:meta-message-read'
function snapshotKey() {
 const secret = process.env.JWT_SECRET?.trim()
 if (!secret) throw new Error('JWT_SECRET is required')
 // Domain separation: snapshots cannot validate as authentication JWTs, even if
 // a future caller accidentally adds auth-shaped claims to a snapshot.
 return createHmac('sha256', secret).update('legalhub/meta-message-snapshot/v1').digest()
}
export async function messageSnapshot(user: any, leadId: string, messages: any[]) {
 const throughReceipt = messages.reduce((max, message) => message.liveReceipt != null ? Math.max(max, message.liveReceipt) : max, 0)
 return new SignJWT({ purpose: 'meta-message-snapshot', userId: user.id, organizationId: user.organizationId, leadId, throughReceipt, version: user.sessionVersion })
  .setProtectedHeader({ alg: 'HS256', typ: 'meta-message-snapshot+jwt' }).setAudience(audience).setIssuer(audience).setIssuedAt().setExpirationTime('15m').sign(snapshotKey())
}
export async function parseMessageSnapshot(token: string, user: any, leadId: string) {
 try {
  const { payload: value, protectedHeader } = await jwtVerify(token, snapshotKey(), { algorithms: ['HS256'], audience, issuer: audience })
  if (protectedHeader.typ !== 'meta-message-snapshot+jwt' || value.purpose !== 'meta-message-snapshot' || value.userId !== user.id || value.organizationId !== user.organizationId || value.leadId !== leadId || value.version !== user.sessionVersion || !Number.isSafeInteger(value.throughReceipt) || Number(value.throughReceipt)<0) return null
  return Number(value.throughReceipt)
 } catch { return null }
}
