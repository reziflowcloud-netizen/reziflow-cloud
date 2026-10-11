import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { isSystemAdmin } from '@/lib/organizationProvisioning'
import { isConferenceDemoSession } from '@/lib/conferenceDemo'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const user = await getUser()
  if (!user) redirect('/')
  return <SettingsClient canManageAll={!isConferenceDemoSession(user) && isSystemAdmin(user)} canManageBilling={user.role === 'admin' || user.role === 'owner'} />
}
