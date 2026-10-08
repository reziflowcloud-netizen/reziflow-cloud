'use client'
import { useEffect, useRef } from 'react'
import { markScreenFetched, registerScreenRefresh } from '@/lib/screenRefresh'

export function useScreenRefresh(load: () => Promise<unknown>, ready: () => boolean = () => true) {
  const current = useRef({ load, ready })
  current.current = { load, ready }
  useEffect(() => registerScreenRefresh({
    load: () => current.current.load(),
    ready: () => current.current.ready(),
  }), [])
}
export { markScreenFetched }
