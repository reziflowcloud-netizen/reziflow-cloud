export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict'
export const CASE_AUTOSAVE_FIELDS = new Set([
  'caseNumber', 'status', 'serviceId', 'stayPurpose', 'stayType', 'contractType',
  'contractDate', 'contractNumber', 'contractSigned', 'mosNumber', 'mosSentByPost', 'mosEmail',
  'personalAppearDate', 'personalAppearTime', 'personalAppearLocation', 'personalAppearanceNote',
  'cardPickupDate', 'cardPickupTime', 'cardPickupLocation', 'legalStayDeadline', 'notes',
  'trustee', 'employeeId', 'workContractType', 'workContractNumber', 'workContractDate',
  'workContractEndDate', 'workContractSigned', 'staySubPurpose',
])
// Financial values, credentials and dates with separate client reminder writes stay explicit.
export class CaseAutosave {
  baseline: Record<string, unknown> = {}
  values: Record<string, unknown> = {}
  version = ''
  state: SaveState = 'idle'
  revision = 0
  private flight: Promise<boolean> | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  constructor(private write: (patch: Record<string, unknown>, version: string) => Promise<string>, private notify: () => void) {}
  get dirty() { return Object.keys(this.values).some(key => this.values[key] !== this.baseline[key]) }
  get busy() { return this.flight !== null }
  get safeToRefresh() { return !this.dirty && !this.busy && this.state !== 'conflict' }
  initialize(values: Record<string, unknown>, version: string) {
    this.cancelTimer()
    this.baseline = { ...values }; this.values = { ...values }; this.version = version; this.state = 'idle'; this.notify()
  }
  change(key: string, value: unknown) {
    this.revision++
    this.values = { ...this.values, [key]: value }
    if (this.state !== 'conflict' && this.state !== 'error') {
      this.state = 'dirty'
      this.cancelTimer()
      if (CASE_AUTOSAVE_FIELDS.has(key)) this.timer = setTimeout(() => { void this.flush() }, 850)
    }
    this.notify()
  }
  private cancelTimer() { if (this.timer) clearTimeout(this.timer); this.timer = null }
  private patch(manual: boolean) {
    return Object.fromEntries(Object.entries(this.values).filter(([key, value]) =>
      value !== this.baseline[key] && (manual || CASE_AUTOSAVE_FIELDS.has(key))))
  }
  async flush(manual = false): Promise<boolean> {
    this.cancelTimer()
    if (this.state === 'conflict') return false
    if (this.flight) {
      const success = await this.flight
      return success ? this.flush(manual) : false
    }
    const patch = this.patch(manual)
    if (!Object.keys(patch).length) {
      if (!this.dirty && this.state !== 'error') this.state = 'saved'
      this.notify(); return !this.dirty
    }
    this.state = 'saving'
    const task = (async () => {
      try {
        this.version = await this.write(patch, this.version)
        this.baseline = { ...this.baseline, ...patch }
        this.state = this.dirty ? 'dirty' : 'saved'
        return true
      } catch (error) {
        this.state = (error as { status?: number })?.status === 409 ? 'conflict' : 'error'
        return false
      } finally { this.flight = null; this.notify() }
    })()
    this.flight = task
    this.notify()
    const success = await task
    if (success && Object.keys(this.patch(manual)).length) return this.flush(manual)
    return success && !this.dirty
  }
  dispose() { this.cancelTimer() }
}
