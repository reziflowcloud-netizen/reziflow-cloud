// src/app/cases/layout.tsx
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import MobileNav from '@/components/layout/MobileNav'
import { LanguageProvider } from '@/context/LanguageContext'
import ConferenceDemoBar from '@/components/ConferenceDemoBar'
import { isConferenceDemoSession } from '@/lib/conferenceDemo'
import { CaseMobileAccessProvider } from './CaseMobileAccessContext'

export default async function CasesLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect('/')
  return (
    <LanguageProvider>
      <div style={{ display: 'flex' }}>
        <Sidebar userName={user.name as string} userRole={user.role as string} userAvatarUrl={(user as any).avatarUrl as string} organizationName={user.organizationName as string} />
        <div className="main-content" style={{ flex: 1 }}>
          {isConferenceDemoSession(user) && <ConferenceDemoBar />}
          <CaseMobileAccessProvider restrictedAccess={user.restrictedAccess === true}>
            {children}
          </CaseMobileAccessProvider>
        </div>
      </div>
      <MobileNav />
    </LanguageProvider>
  )
}
