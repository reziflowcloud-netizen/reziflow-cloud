export const PUSH_PILOT_WORKER_VERSION = 'notification-click-existing-window-2'
export const PUSH_PILOT_TRACE_STAGES = ['worker-check', 'push-received', 'click-start', 'clients-found', 'focus-ok', 'focus-failed', 'page-ack', 'page-timeout', 'navigate-ok', 'navigate-null', 'navigate-failed', 'open-window', 'open-window-null', 'open-window-failed'] as const
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export function validPushPilotTrace(body: any) {
  return body && Object.keys(body).every(key => ['notificationId', 'workerVersion', 'instanceId', 'stage'].includes(key))
    && typeof body.notificationId === 'string' && uuid.test(body.notificationId)
    && body.workerVersion === PUSH_PILOT_WORKER_VERSION
    && typeof body.instanceId === 'string' && uuid.test(body.instanceId)
    && PUSH_PILOT_TRACE_STAGES.includes(body.stage)
}
