'use client'

import { createContext, useContext, type ReactNode } from 'react'

const LeadMobileAccessContext = createContext({ restrictedAccess: false, userId: 0, organizationId: '' })

export function LeadMobileAccessProvider({
  restrictedAccess,
  userId,
  organizationId,
  children,
}: {
  restrictedAccess: boolean
  userId: number
  organizationId: string
  children: ReactNode
}) {
  return (
    <LeadMobileAccessContext.Provider value={{ restrictedAccess, userId, organizationId }}>
      {children}
    </LeadMobileAccessContext.Provider>
  )
}

export function useLeadMobileAccess() {
  return useContext(LeadMobileAccessContext)
}
