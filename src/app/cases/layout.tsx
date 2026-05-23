// src/app/cases/layout.tsx
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import MobileNav from '@/components/layout/MobileNav'
import { LanguageProvider } from '@/context/LanguageContext'

export default async function CasesLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect('/')
  return (
    <LanguageProvider>
      <div style={{ display: 'flex' }}>
        <Sidebar userName={user.name as string} userRole={user.role as string} userAvatarUrl={(user as any).avatarUrl as string} organizationName={user.organizationName as string} />
        <div className="main-content" style={{ flex: 1 }}>{children}</div>
      </div>
      <MobileNav />
    </LanguageProvider>
  )
}
