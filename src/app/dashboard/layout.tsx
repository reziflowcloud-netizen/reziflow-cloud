// src/app/dashboard/layout.tsx
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import MobileNav from '@/components/layout/MobileNav'
import { LanguageProvider } from '@/context/LanguageContext'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect('/')
  return (
    <LanguageProvider>
      <div style={{ display: 'flex' }}>
        <Sidebar userName={user.name as string} />
        <div className="main-content" style={{ flex: 1 }}>
          {children}
        </div>
      </div>
      {/* Нижнее меню — видно только на мобиле (скрыто через CSS на десктопе) */}
      <MobileNav />
    </LanguageProvider>
  )
}
