'use client'

import { useEffect } from 'react'

type Props = {
  scope: string
}

export default function CollapsibleCardsBehavior({ scope }: Props) {
  useEffect(() => {
    const root = document.querySelector(`[data-collapsible-scope="${scope}"]`)
    if (!root) return

    const cleanups: Array<() => void> = []

    const wireCards = () => {
      const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-collapsible-card], .card'))
      cards.forEach((card, index) => {
      const header = (
        card.querySelector<HTMLElement>('[data-collapse-header]') ||
        card.querySelector<HTMLElement>(':scope > .section-title') ||
        card.firstElementChild as HTMLElement | null
      )
      if (!header || header.dataset.collapseReady === '1') return

      const body = Array.from(card.children).filter(child => child !== header) as HTMLElement[]
      if (body.length === 0) return
      const bodyDisplays = body.map(el => el.style.display)
      const headerMarginBottom = header.style.marginBottom
      const headerPaddingBottom = header.style.paddingBottom
      const headerBorderBottom = header.style.borderBottom

      const key = card.dataset.collapseKey || `${scope}-${index}`
      const storageKey = `reziflow:collapsed:${key}`
      let collapsed = localStorage.getItem(storageKey) === '1'

      const originalNodes = Array.from(header.childNodes)
      const headerLeft = document.createElement('div')
      headerLeft.dataset.collapseLeft = '1'
      headerLeft.style.display = 'inline-flex'
      headerLeft.style.alignItems = 'center'
      headerLeft.style.gap = '10px'
      headerLeft.style.minWidth = '0'
      headerLeft.style.flex = '1'
      headerLeft.style.justifyContent = 'flex-start'

      originalNodes.forEach(node => headerLeft.appendChild(node))
      header.appendChild(headerLeft)

      header.dataset.collapseReady = '1'
      header.style.display = 'flex'
      header.style.alignItems = 'center'
      header.style.justifyContent = 'space-between'
      header.style.gap = '12px'

      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'btn btn-ghost'
      button.setAttribute('aria-label', collapsed ? 'Развернуть сектор' : 'Свернуть сектор')
      button.style.padding = '4px 9px'
      button.style.minWidth = '32px'
      button.style.height = '30px'
      button.style.justifyContent = 'center'
      button.style.fontSize = '15px'

      const paint = () => {
        body.forEach((el, bodyIndex) => {
          el.style.display = collapsed ? 'none' : bodyDisplays[bodyIndex]
        })
        button.textContent = collapsed ? '›' : '⌄'
        button.title = collapsed ? 'Развернуть' : 'Свернуть'
        header.style.marginBottom = collapsed ? '0' : headerMarginBottom
        header.style.paddingBottom = collapsed ? '0' : headerPaddingBottom
        header.style.borderBottom = collapsed ? 'none' : headerBorderBottom
      }

      const onClick = () => {
        collapsed = !collapsed
        localStorage.setItem(storageKey, collapsed ? '1' : '0')
        paint()
      }

      button.addEventListener('click', onClick)
      header.appendChild(button)
      paint()
      cleanups.push(() => {
        button.removeEventListener('click', onClick)
        button.remove()
        body.forEach((el, bodyIndex) => {
          el.style.display = bodyDisplays[bodyIndex]
        })
        header.style.marginBottom = headerMarginBottom
        header.style.paddingBottom = headerPaddingBottom
        header.style.borderBottom = headerBorderBottom
        originalNodes.forEach(node => header.appendChild(node))
        headerLeft.remove()
        delete header.dataset.collapseReady
      })
      })
    }

    wireCards()
    const observer = new MutationObserver(() => wireCards())
    observer.observe(root, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      cleanups.forEach(cleanup => cleanup())
    }
  }, [scope])

  return null
}
