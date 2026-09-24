// src/app/dashboard/layout.tsx
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import MobileNav from '@/components/layout/MobileNav'
import { LanguageProvider } from '@/context/LanguageContext'
import ConferenceDemoBar from '@/components/ConferenceDemoBar'
import { isConferenceDemoSession } from '@/lib/conferenceDemo'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
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
        <div className="main-content" style={{ flex: 1, minWidth: 0 }}>
          {isConferenceDemoSession(user) && <ConferenceDemoBar />}
          {children}
        </div>
      </div>
      {/* Нижнее меню — видно только на мобиле (скрыто через CSS на десктопе) */}
      <MobileNav />
    </LanguageProvider>
  )
}
