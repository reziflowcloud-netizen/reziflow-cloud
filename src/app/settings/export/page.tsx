'use client'
import { useState } from 'react'

export default function ExportPage() {
  const [loading, setLoading] = useState<string | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)

  async function doExport(type: string, filename: string) {
    setLoading(type)
    setLastError(null)
    try {
      const res = await fetch(`/api/export?type=${type}`)
      const contentType = res.headers.get('content-type') || ''

      if (!res.ok || contentType.includes('json')) {
        const data = await res.json()
        setLastError(data.details || data.error || 'Неизвестная ошибка')
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename + '_' + new Date().toISOString().slice(0,10) + '.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setLastError(String(e))
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Экспорт данных</div>
          <div className="page-subtitle">Скачайте данные в формате CSV для Google Таблиц или Excel</div>
        </div>
      </div>

      <div className="page-body">
        {lastError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: '#dc2626', fontSize: 13 }}>
            <strong>Ошибка:</strong> {lastError}
          </div>
        )}

        <div className="card" style={{ marginBottom: 24, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 24 }}>💡</span>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Как импортировать в Google Таблицы</div>
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                1. Скачайте CSV файл кнопкой ниже<br/>
                2. Откройте Google Таблицы → Файл → Импорт<br/>
                3. Загрузите файл → выберите <strong>"Запятая"</strong> как разделитель<br/>
                4. Нажмите "Импортировать данные" ✅
              </div>
            </div>
          </div>
        </div>

        {/* Main export */}
        <div className="card" style={{ marginBottom: 16, border: '2px solid var(--brand)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 60, height: 60, borderRadius: 14, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, flexShrink: 0 }}>📦</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Полная база данных</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                Один файл: клиент + его дела + все оплаты по каждому делу.<br/>
                Каждая строка = одно дело клиента.
              </div>
            </div>
            <button onClick={() => doExport('all', 'ReziFlowCloud_baza')}
              className="btn btn-primary" disabled={loading === 'all'}
              style={{ padding: '12px 24px', fontSize: 15, flexShrink: 0 }}>
              {loading === 'all' ? '⏳ Подготовка...' : '⬇️ Скачать всё'}
            </button>
          </div>
        </div>

        {/* Separate exports */}
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, fontWeight: 500 }}>Или скачать отдельно:</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { id: 'clients', icon: '👥', title: 'Только клиенты', desc: 'Личные данные', filename: 'ReziFlowCloud_clients', color: '#eff6ff' },
            { id: 'cases',   icon: '📋', title: 'Только дела',    desc: 'Дела и суммы',  filename: 'ReziFlowCloud_cases',   color: '#fef3c7' },
            { id: 'payments',icon: '💳', title: 'Только оплаты',  desc: 'История платежей', filename: 'ReziFlowCloud_payments', color: '#dcfce7' },
          ].map(exp => (
            <div key={exp.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: exp.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{exp.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{exp.title}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{exp.desc}</div>
              </div>
              <button onClick={() => doExport(exp.id, exp.filename)} className="btn btn-secondary"
                disabled={loading === exp.id} style={{ fontSize: 12, padding: '6px 12px', flexShrink: 0 }}>
                {loading === exp.id ? '⏳' : '⬇️ CSV'}
              </button>
            </div>
          ))}
        </div>

        <div className="card" style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>📅 Рекомендации по резервному копированию</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { icon: '📆', title: 'Раз в неделю', desc: 'Скачивай полную базу каждую пятницу' },
              { icon: '💾', title: 'Google Drive', desc: 'Создай папку "Бэкапы ReziFlow Cloud"' },
              { icon: '🔄', title: 'Перед изменениями', desc: 'Делай экспорт перед обновлениями' },
            ].map(tip => (
              <div key={tip.title} style={{ display: 'flex', gap: 12 }}>
                <span style={{ fontSize: 24 }}>{tip.icon}</span>
                <div>
                  <div style={{ fontWeight: 500, marginBottom: 2 }}>{tip.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{tip.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
