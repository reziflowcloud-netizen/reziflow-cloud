import type { ReactNode } from 'react'
import styles from './MobileHeaderActions.module.css'

export default function MobileHeaderActions({ children }: { children: ReactNode }) {
  return <div data-mobile-header-actions className={styles.group}>{children}</div>
}
