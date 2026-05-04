'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

type StatusItem = {
  id: number
  name: string
  color: string
  order: number
}

type CaseItem = {
  id: string
  caseNumber?: string | null
  status: string
  service?: { name: string; color?: string | null } | null
  totalValue: number
  totalPaid: number
}

type ClientItem = {
  id: string
  firstName: string
  lastName: string
  phone?: string | null
  cases: CaseItem[]
}

function clientName(client: ClientItem) {
  return `${client.firstName || ''} ${client.lastName || ''}`.trim()
}

export default function StagesClient({ statuses, clients }: { statuses: StatusItem[]; clients: ClientItem[] }) {
  const [clientQuery, setClientQuery] = useState('')

  const columns = useMemo(() => {
    const statusNames = new Set(statuses.map(status => status.name))
    const extraStatuses = Array.from(
      new Set(clients.flatMap(client => client.cases.map(item => item.status)).filter(status => !statusNames.has(status)))
    ).map((name, index) => ({ id: -index - 1, name, color: '#94a3b8', order: statuses.length + index }))

    return [...statuses, ...extraStatuses]
  }, [statuses, clients])

  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase()
    if (!q) return clients

    return clients.filter(client =>
      `${client.firstName || ''} ${client.lastName || ''} ${client.phone || ''}`.toLowerCase().includes(q)
    )
  }, [clientQuery, clients])

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Этапы</div>
          <div className="page-subtitle">Клиенты по вертикали, статусы дел по горизонтали</div>
        </div>
        <Link href="/settings/statuses" className="btn btn-secondary">Настроить статусы</Link>
      </div>

      <div className="page-body">
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title">Обзор</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <span className="badge" style={{ background: '#eef2ff', color: '#3730a3' }}>Клиентов: {filteredClients.length} / {clients.length}</span>
            <span className="badge" style={{ background: '#ecfdf5', color: '#047857' }}>Статусов: {columns.length}</span>
            <span className="badge" style={{ background: '#f8fafc', color: '#475569' }}>Галочка означает, что у клиента есть дело на этом этапе</span>
          </div>
          <div className="form-group" style={{ margin: 0, maxWidth: 460 }}>
            <label className="label">Поиск клиента</label>
            <input
              className="input"
              value={clientQuery}
              onChange={event => setClientQuery(event.target.value)}
              placeholder="Начните вводить имя или фамилию"
            />
          </div>
        </div>

        <div className="table-container">
          <div className="table-scroll">
            <table className="table stages-table" style={{ minWidth: Math.max(760, 260 + columns.length * 130) }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, zIndex: 2, minWidth: 240 }}>Клиент</th>
                  {columns.map(status => (
                    <th key={status.id} style={{ textAlign: 'center', minWidth: 130 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, justifyContent: 'center' }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: status.color, flexShrink: 0 }} />
                        <span>{status.name}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 1} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>
                      Клиенты не найдены
                    </td>
                  </tr>
                ) : filteredClients.map(client => {
                  const casesByStatus = new Map<string, CaseItem[]>()
                  for (const item of client.cases) {
                    casesByStatus.set(item.status, [...(casesByStatus.get(item.status) || []), item])
                  }

                  return (
                    <tr key={client.id}>
                      <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--surface)', minWidth: 240 }}>
                        <Link href={`/clients/${client.id}`} style={{ fontWeight: 700, color: 'var(--text)', textDecoration: 'none' }}>
                          {clientName(client)}
                        </Link>
                        <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 3 }}>
                          {client.phone || 'Телефон не указан'} · дел: {client.cases.length}
                        </div>
                      </td>
                      {columns.map(status => {
                        const statusCases = casesByStatus.get(status.name) || []
                        const paid = statusCases.reduce((sum, item) => sum + Number(item.totalPaid || 0), 0)
                        const value = statusCases.reduce((sum, item) => sum + Number(item.totalValue || 0), 0)

                        return (
                          <td key={status.id} style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                            {statusCases.length > 0 ? (
                              <div style={{ display: 'grid', gap: 5, justifyItems: 'center' }}>
                                <span
                                  title={statusCases.map(item => item.service?.name || 'Без услуги').join(', ')}
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: '50%',
                                    background: '#16a34a',
                                    color: 'white',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 800,
                                    boxShadow: '0 0 0 4px rgba(22, 163, 74, 0.12)',
                                  }}
                                >
                                  ✓
                                </span>
                                {statusCases.length > 1 && (
                                  <span className="badge" style={{ background: '#dcfce7', color: '#166534' }}>{statusCases.length} дела</span>
                                )}
                                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                  {paid.toFixed(0)} / {value.toFixed(0)} zł
                                </div>
                                <div style={{ display: 'grid', gap: 2 }}>
                                  {statusCases.slice(0, 2).map(item => (
                                    <Link
                                      key={item.id}
                                      href={`/cases/${item.id}`}
                                      className="badge"
                                      style={{
                                        background: `${item.service?.color || '#64748b'}20`,
                                        color: item.service?.color || '#475569',
                                        textDecoration: 'none',
                                        justifyContent: 'center',
                                        maxWidth: 128,
                                      }}
                                      title={item.service?.name || 'Без услуги'}
                                    >
                                      {item.service?.name || 'Без услуги'}
                                    </Link>
                                  ))}
                                  {statusCases.length > 2 && <span style={{ fontSize: 11, color: 'var(--muted)' }}>+ еще {statusCases.length - 2}</span>}
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--border)' }}>-</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
