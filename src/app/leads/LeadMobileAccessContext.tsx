'use client'

import { createContext, useContext, type ReactNode } from 'react'

const LeadMobileAccessContext = createContext({ restrictedAccess: false })

export function LeadMobileAccessProvider({
  restrictedAccess,
  children,
}: {
  restrictedAccess: boolean
  children: ReactNode
}) {
  return (
    <LeadMobileAccessContext.Provider value={{ restrictedAccess }}>
      {children}
    </LeadMobileAccessContext.Provider>
  )
}

export function useLeadMobileAccess() {
  return useContext(LeadMobileAccessContext)
}
