// Review artifact only: produces the exact two-schedule configuration without
// contacting a provider, reading credentials, or generating notifications.
import {notificationSchedules,notificationQueue,notificationDestination,qstashOrigin} from '../src/lib/notificationQstash.mjs'
import {pathToFileURL} from 'node:url'
import {resolve} from 'node:path'
export function organizationNotificationSchedulePlan() {
 return {provider:qstashOrigin,destination:notificationDestination,queue:notificationQueue,parallelism:1,retries:2,timeout:'55s',redactFields:'body,header[Authorization]',authentication:'existing Production CRON_SECRET via forwarded Authorization header',schedules:notificationSchedules.map(s=>({...s,timeZone:'UTC'})),activation:'deferred until Production model review',configured:false}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(JSON.stringify(organizationNotificationSchedulePlan(),null,2))
