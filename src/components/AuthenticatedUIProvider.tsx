import { LanguageProvider } from '@/context/LanguageContext'
import { NotificationFeatureProvider } from '@/context/NotificationFeatureContext'

// Authenticated layouts already read cookies and render dynamically. Only the
// global feature flag crosses this boundary; notification data stays API-scoped.
export default function AuthenticatedUIProvider({ children }: { children: React.ReactNode }) {
  return <NotificationFeatureProvider enabled={process.env.NOTIFICATIONS_ENABLED === 'true'}>
    <LanguageProvider>{children}</LanguageProvider>
  </NotificationFeatureProvider>
}
