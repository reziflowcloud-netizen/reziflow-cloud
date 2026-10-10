// Memory only: a cold launch with old unread notifications is not a resume.
export type NotificationResumeState = { scope: string; serverTime: string; newUnreadId: string | null }
export class NotificationResumeTracker {
  private scope = ''
  private clock = 0
  private anchor = 0
  private boundary: string | null = null
  private hiddenAt: number | null = null
  private resumed = false
  showing = false

  reset() {
    this.scope = ''; this.clock = 0; this.anchor = 0
    this.acknowledge()
  }
  acknowledge() { this.boundary = null; this.hiddenAt = null; this.resumed = false; this.showing = false }
  background(now: number) {
    if (this.hiddenAt !== null) return
    this.hiddenAt = now
    // Project the authenticated server clock; device wall-clock skew is irrelevant.
    if (this.clock) this.boundary = new Date(this.clock + Math.max(0, now - this.anchor)).toISOString()
    this.resumed = false
  }
  resume() { if (this.hiddenAt !== null) this.resumed = true }
  since() { return this.resumed ? this.boundary : null }
  observe(state: NotificationResumeState, now: number, requestedSince: string | null, visible: boolean) {
    const clock = Date.parse(state.serverTime)
    if (!Number.isFinite(clock) || !state.scope) return
    if (this.scope && this.scope !== state.scope) this.reset()
    this.scope = state.scope; this.clock = clock; this.anchor = now
    // A fast background transition can precede the first completed sync.
    // Once its server clock arrives, reconstruct the saved monotonic boundary.
    if (this.hiddenAt !== null && !this.boundary) this.boundary = new Date(clock + this.hiddenAt - now).toISOString()
    // A pre-background or dismissed request cannot resurrect a banner.
    if (!visible || !requestedSince || requestedSince !== this.since()) return
    if (state.newUnreadId) this.showing = true
    else this.acknowledge()
  }
}

export function mobileStandalone(mobile: boolean, standalone: boolean, appleStandalone?: boolean) {
  return mobile && (standalone || appleStandalone === true)
}
