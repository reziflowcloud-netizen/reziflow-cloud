'use client'

import { createContext, useContext, type ReactNode } from 'react'

const ClientMobileAccessContext = createContext({ restrictedAccess: false })

export function ClientMobileAccessProvider({
  restrictedAccess,
  children,
}: {
  restrictedAccess: boolean
  children: ReactNode
}) {
  return (
    <ClientMobileAccessContext.Provider value={{ restrictedAccess }}>
      {children}
    </ClientMobileAccessContext.Provider>
  )
}

export function useClientMobileAccess() {
  return useContext(ClientMobileAccessContext)
}
