'use client'

import { useState } from 'react'

type PreviewData = {
  headers: string[]
  rowCount: number
  previewRows: Record<string, string>[]
  columnMap: {
    client: Record<string, string>
    case: Record<string, string>
    unknown: string[]
  }
}

type ImportResult = {
  importedRows: number
  clientsCreated: number
  clientsReused: number
  casesCreated: number
  customFieldsCreatedOrUsed: number
  customValuesSaved: number
}

const clientLabels: Record<string, string> = {
  firstName: 'Имя',
  lastName: 'Фамилия',
  phone: 'Телефон',
  email: 'Email',
  pesel: 'PESEL',
  birthDate: 'Дата рождения',
  citizenship: 'Гражданство',
  addressInPoland: 'Адрес в Польше',
}

const caseLabels: Record<string, string> = {
  status: 'Статус дела',
  totalValue: 'Стоимость',
  totalPaid: 'Оплачено',
  notes: 'Заметки',
  filingDate: 'Дата подачи',
  contractDate: 'Дата договора',
}

export default function ExportPage() {
  const [loading, setLoading] = useState<string | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [limit, setLimit] = useState(5)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

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
      a.download = filename + '_' + new Date().toISOString().slice(0, 10) + '.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setLastError(String(e))
    } finally {
      setLoading(null)
    }
  }

  async function doPreview() {
    if (!file) {
      setLastError('Выберите CSV-файл для импорта')
      return
    }
    setLoading('import-preview')
    setLastError(null)
    setImportResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/import', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setLastError(data.details || data.error || 'Не удалось прочитать файл')
        return
      }
      setPreview(data)
      setLimit(Math.min(5, Math.max(1, data.rowCount || 1)))
    } catch (e: any) {
      setLastError(String(e))
    } finally {
      setLoading(null)
    }
  }

  async function doImport() {
    if (!file || !preview) {
      setLastError('Сначала сделайте предпросмотр файла')
      return
    }
    setLoading('import-confirm')
    setLastError(null)
    setImportResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('confirm', 'true')
      formData.append('limit', String(limit))
      const res = await fetch('/api/import', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setLastError(data.details || data.error || 'Не удалось импортировать файл')
        return
      }
      setImportResult(data)
    } catch (e: any) {
      setLastError(String(e))
    } finally {
      setLoading(null)
    }
  }

  const mappedClient = preview ? Object.entries(preview.columnMap.client) : []
  const mappedCase = preview ? Object.entries(preview.columnMap.case) : []

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Экспорт и импорт данных</div>
          <div className="page-subtitle">CSV-файлы для переноса клиентов, дел и резервной копии ReziFlow Cloud</div>
        </div>
      </div>

      <div className="page-body">
        {lastError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: '#dc2626', fontSize: 13 }}>
            <strong>Ошибка:</strong> {lastError}
          </div>
        )}

        {importResult && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: '#166534', fontSize: 13 }}>
            Импортировано строк: <strong>{importResult.importedRows}</strong>. Клиентов создано: <strong>{importResult.clientsCreated}</strong>, найдено существующих: <strong>{importResult.clientsReused}</strong>, дел создано: <strong>{importResult.casesCreated}</strong>. Дополнительных значений сохранено: <strong>{importResult.customValuesSaved}</strong>.
          </div>
        )}

        <div className="card" style={{ marginBottom: 20, border: '2px solid var(--brand)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Импорт клиентов и дел из CSV</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, maxWidth: 760 }}>
                Сначала файл только проверяется. Распознанные колонки попадут в клиента и дело, а неизвестные колонки автоматически создадут поля в деле в секции <strong>Импортированные данные</strong>.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => doExport('import-template', 'ReziFlowCloud_import_template')}
                disabled={loading === 'import-template'}
                style={{ whiteSpace: 'nowrap' }}
              >
                {loading === 'import-template' ? 'Скачиваю...' : 'Скачать бланк CSV'}
              </button>
              <span style={{ fontSize: 28 }}>📥</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) auto auto', gap: 10, alignItems: 'center' }}>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={event => {
                setFile(event.target.files?.[0] || null)
                setPreview(null)
                setImportResult(null)
                setLastError(null)
              }}
            />
            <button className="btn btn-secondary" onClick={doPreview} disabled={loading === 'import-preview'}>
              {loading === 'import-preview' ? 'Проверяю...' : 'Предпросмотр'}
            </button>
            <button className="btn btn-primary" onClick={doImport} disabled={!preview || loading === 'import-confirm'}>
              {loading === 'import-confirm' ? 'Импортирую...' : 'Импортировать'}
            </button>
          </div>

          {preview && (
            <div style={{ marginTop: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 14 }}>
                <div className="card" style={{ padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Строк в файле</div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{preview.rowCount}</div>
                </div>
                <div className="card" style={{ padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Колонок</div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{preview.headers.length}</div>
                </div>
                <div className="card" style={{ padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Распознано</div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{mappedClient.length + mappedCase.length}</div>
                </div>
                <div className="card" style={{ padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Доп. поля</div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{preview.columnMap.unknown.length}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>Что попадет в карточку клиента</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {mappedClient.length === 0 && <span style={{ color: 'var(--muted)', fontSize: 13 }}>Пока не распознано</span>}
                    {mappedClient.map(([field, header]) => (
                      <span key={field} style={{ border: '1px solid var(--border)', borderRadius: 999, padding: '5px 9px', fontSize: 12 }}>
                        {clientLabels[field] || field}: <strong>{header}</strong>
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>Что попадет в дело</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {mappedCase.length === 0 && <span style={{ color: 'var(--muted)', fontSize: 13 }}>Пока не распознано</span>}
                    {mappedCase.map(([field, header]) => (
                      <span key={field} style={{ border: '1px solid var(--border)', borderRadius: 999, padding: '5px 9px', fontSize: 12 }}>
                        {caseLabels[field] || field}: <strong>{header}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card" style={{ padding: 12, marginBottom: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Неизвестные колонки</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
                  Эти колонки будут сохранены в деле как настраиваемые поля. Например, <strong>pracodawca</strong> не потеряется.
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {preview.columnMap.unknown.slice(0, 80).map(header => (
                    <span key={header} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 999, padding: '5px 9px', fontSize: 12 }}>{header}</span>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <label style={{ fontWeight: 600, fontSize: 13 }}>Сколько строк импортировать сейчас</label>
                <input
                  type="number"
                  min={1}
                  max={preview.rowCount}
                  value={limit}
                  onChange={event => setLimit(Math.max(1, Math.min(preview.rowCount, Number(event.target.value) || 1)))}
                  style={{ width: 110 }}
                />
                <span style={{ color: 'var(--muted)', fontSize: 13 }}>Для теста лучше начать с 3-5 строк.</span>
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {preview.headers.slice(0, 10).map(header => (
                        <th key={header} style={{ textAlign: 'left', padding: 8, background: 'var(--bg)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.previewRows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {preview.headers.slice(0, 10).map(header => (
                          <td key={header} style={{ padding: 8, borderBottom: '1px solid var(--border)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row[header]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 60, height: 60, borderRadius: 14, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, flexShrink: 0 }}>📦</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Полная база данных</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                Один файл: клиенты, дела, оплаты и дополнительные поля.
              </div>
            </div>
            <button onClick={() => doExport('all', 'ReziFlowCloud_baza')}
              className="btn btn-primary" disabled={loading === 'all'}
              style={{ padding: '12px 24px', fontSize: 15, flexShrink: 0 }}>
              {loading === 'all' ? 'Подготовка...' : 'Скачать все'}
            </button>
          </div>
        </div>

        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, fontWeight: 500 }}>Или скачать отдельно:</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { id: 'clients', icon: '👥', title: 'Только клиенты', desc: 'Личные данные', filename: 'ReziFlowCloud_clients', color: '#eff6ff' },
            { id: 'cases', icon: '📋', title: 'Только дела', desc: 'Дела и суммы', filename: 'ReziFlowCloud_cases', color: '#fef3c7' },
            { id: 'payments', icon: '💳', title: 'Только оплаты', desc: 'История платежей', filename: 'ReziFlowCloud_payments', color: '#dcfce7' },
          ].map(exp => (
            <div key={exp.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: exp.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{exp.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{exp.title}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{exp.desc}</div>
              </div>
              <button onClick={() => doExport(exp.id, exp.filename)} className="btn btn-secondary"
                disabled={loading === exp.id} style={{ fontSize: 12, padding: '6px 12px', flexShrink: 0 }}>
                {loading === exp.id ? '...' : 'CSV'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
