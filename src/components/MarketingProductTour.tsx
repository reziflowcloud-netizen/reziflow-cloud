'use client'
import { useEffect, useState } from 'react'
import type { ProductTourCopy } from '@/lib/marketingI18n'

export default function MarketingProductTour({ copy }: { copy: ProductTourCopy }) {
  const [activeId, setActiveId] = useState(copy.modules[0]?.id || '')
  const active = copy.modules.find(item => item.id === activeId) || copy.modules[0]

  useEffect(() => {
    if (!copy.modules.some(item => item.id === activeId)) {
      setActiveId(copy.modules[0]?.id || '')
    }
  }, [activeId, copy.modules])

  if (!active) return null

  return (
    <div className="product-tour">
      <div className="section-heading-row product-tour-heading">
        <div>
          <p className="marketing-kicker">{copy.kicker}</p>
          <h2>{copy.title}</h2>
        </div>
        <p>{copy.text}</p>
      </div>

      <div className="product-tour-tabs" role="tablist" aria-label={copy.ariaLabel}>
        {copy.modules.map(item => (
          <button
            key={item.id}
            type="button"
            className={item.id === active.id ? 'active' : ''}
            onClick={() => setActiveId(item.id)}
            role="tab"
            aria-selected={item.id === active.id}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="product-tour-body">
        <div className="product-tour-copy">
          <h2>{active.title}</h2>
          <p>{active.text}</p>
        </div>

        <div className="product-tour-preview" aria-label={`${copy.previewAriaPrefix}: ${active.label}`}>
          <div className="tour-window-bar">
            <span /><span /><span />
            <strong>{active.label}</strong>
          </div>
          <div className="tour-metrics">
            {active.stats.map(stat => <div key={stat}>{stat}</div>)}
          </div>
          <div className="tour-table">
            {active.rows.map(row => (
              <div className="tour-row" key={row.join('-')}>
                <strong>{row[0]}</strong>
                <span>{row[1]}</span>
                <em>{row[2]}</em>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
