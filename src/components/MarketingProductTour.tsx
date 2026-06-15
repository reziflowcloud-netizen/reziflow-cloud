'use client'
import { useEffect, useState } from 'react'
import type { ProductTourCopy } from '@/lib/marketingI18n'

const demoImageVersion = '20260614-2'
const tourImages: Record<string, string> = {
  leads: `/assets/legalhub/demo-leads.png?v=${demoImageVersion}`,
  cases: `/assets/legalhub/demo-cases.png?v=${demoImageVersion}`,
  documents: `/assets/legalhub/demo-documents.png?v=${demoImageVersion}`,
  control: `/assets/legalhub/demo-control.png?v=${demoImageVersion}`,
}

export default function MarketingProductTour({ copy }: { copy: ProductTourCopy }) {
  const [activeId, setActiveId] = useState(copy.modules[0]?.id || '')
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string; label: string } | null>(null)
  const active = copy.modules.find(item => item.id === activeId) || copy.modules[0]

  useEffect(() => {
    if (!copy.modules.some(item => item.id === activeId)) {
      setActiveId(copy.modules[0]?.id || '')
    }
  }, [activeId, copy.modules])

  useEffect(() => {
    if (!previewImage) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setPreviewImage(null)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewImage])

  if (!active) return null
  const activeImage = tourImages[active.id]
  const activeImageAlt = `${copy.previewAriaPrefix}: ${active.label}`

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
          {activeImage ? (
            <div className="tour-image-frame">
              <button
                type="button"
                className="tour-image-open"
                onClick={() => setPreviewImage({ src: activeImage, alt: activeImageAlt, label: active.label })}
                aria-label={`Открыть крупнее: ${active.label}`}
              >
                <img
                  className="tour-image"
                  src={activeImage}
                  alt={activeImageAlt}
                  loading="lazy"
                />
                <span className="tour-image-zoom-label">Открыть крупнее</span>
              </button>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>

      {previewImage ? (
        <div className="tour-image-modal" role="dialog" aria-modal="true" aria-label={previewImage.alt}>
          <button
            type="button"
            className="tour-image-modal-backdrop"
            aria-label="Закрыть изображение"
            onClick={() => setPreviewImage(null)}
          />
          <div className="tour-image-modal-panel">
            <div className="tour-image-modal-bar">
              <strong>{previewImage.label}</strong>
              <button type="button" aria-label="Закрыть изображение" onClick={() => setPreviewImage(null)}>×</button>
            </div>
            <img src={previewImage.src} alt={previewImage.alt} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
