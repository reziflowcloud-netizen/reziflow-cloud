'use client'
import { createContext, useContext, type ReactNode } from 'react'

const NotificationFeatureContext = createContext(false)
export function NotificationFeatureProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return <NotificationFeatureContext.Provider value={enabled}>{children}</NotificationFeatureContext.Provider>
}
export const useNotificationFeature = () => useContext(NotificationFeatureContext)
