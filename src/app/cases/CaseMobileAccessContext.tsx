'use client'

import { createContext, useContext } from 'react'

const CaseMobileAccessContext = createContext({ restrictedAccess: false })

export function CaseMobileAccessProvider({
  restrictedAccess,
  children,
}: {
  restrictedAccess: boolean
  children: React.ReactNode
}) {
  return (
    <CaseMobileAccessContext.Provider value={{ restrictedAccess }}>
      {children}
    </CaseMobileAccessContext.Provider>
  )
}

export function useCaseMobileAccess() {
  return useContext(CaseMobileAccessContext)
}
