// src/app/leads/layout.tsx
import { redirect } from 'next/navigation'
import { getOrganizationId, getUser } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import MobileNav from '@/components/layout/MobileNav'
import LanguageProvider from '@/components/AuthenticatedUIProvider'
import ConferenceDemoBar from '@/components/ConferenceDemoBar'
import { isConferenceDemoSession } from '@/lib/conferenceDemo'
import { LeadMobileAccessProvider } from './LeadMobileAccessContext'

export default async function LeadsLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect('/')

  return (
    <LanguageProvider>
      <div style={{ display: 'flex' }}>
        <Sidebar
          userName={user.name as string}
          userRole={user.role as string}
          userAvatarUrl={(user as any).avatarUrl as string}
          organizationName={user.organizationName as string}
        />
        <div className="main-content" style={{ flex: 1 }}>
          {isConferenceDemoSession(user) && <ConferenceDemoBar />}
          <LeadMobileAccessProvider key={JSON.stringify([user.id, getOrganizationId(user)])} userId={Number(user.id)} organizationId={getOrganizationId(user)} restrictedAccess={user.restrictedAccess === true}>
            {children}
          </LeadMobileAccessProvider>
        </div>
      </div>
      <MobileNav />
    </LanguageProvider>
  )
}
