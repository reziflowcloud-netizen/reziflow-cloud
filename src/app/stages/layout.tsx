import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import MobileNav from '@/components/layout/MobileNav'
import { LanguageProvider } from '@/context/LanguageContext'

export default async function StagesLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect('/')
  return (
    <LanguageProvider>
      <div style={{ display: 'flex' }}>
        <Sidebar userName={user.name as string} />
        <div className="main-content" style={{ flex: 1 }}>{children}</div>
      </div>
      <MobileNav />
    </LanguageProvider>
  )
}
