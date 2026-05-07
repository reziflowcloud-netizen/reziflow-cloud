'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import CollapsibleCardsBehavior from '@/components/CollapsibleCardsBehavior'
import SectionVisibilityBehavior from '@/components/SectionVisibilityBehavior'
import CustomSectionsRenderer from '@/components/CustomSectionsRenderer'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'Новый': { bg: '#eff6ff', color: '#1d4ed8' },
  'В работе': { bg: '#fef3c7', color: '#92400e' },
  'Ожидание документов': { bg: '#ede9fe', color: '#5b21b6' },
  'Решение получено': { bg: '#dcfce7', color: '#14532d' },
  'Архив': { bg: '#f3f4f6', color: '#374151' },
  'Отказ': { bg: '#fef2f2', color: '#991b1b' },
}

const COUNTRIES = ['Украина','Россия','Беларусь','Молдова','Грузия','Армения','Казахстан','Узбекистан','Польша','Другое']
const EYE_COLORS = ['Карие','Голубые','Зелёные','Серые','Чёрные','Смешанные']
const MARITAL_STATUS = ['Холост/Не замужем','Женат/Замужем','Разведён/Разведена','Вдовец/Вдова']
const EDUCATION = ['Начальное','Среднее','Среднее специальное','Высшее','Учёная степень']
const LEGAL_TITLE = ['Wynajem (Аренда)','Własność (Собственность)','Użyczenie (Безвозмездное пользование)','Zamieszkanie u rodziny (У родственников)','Inne (Другое)']
const STAY_BASIS = ['Без основания','Виза','Карта побыту','Побыт временный','Побыт постоянный','Безвизовый режим']

const F = ({ label, children, col = false }: any) => (
  <div className="form-group" style={col ? { gridColumn: '1/-1' } : {}}>
    <label className="label">{label}</label>
    {children}
  </div>
)

export default function ClientDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const backTo = searchParams.get('backTo') || '/clients'
  const [client, setClient] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [travelHistory, setTravelHistory] = useState<any[]>([])
  const [newTravel, setNewTravel] = useState({ country: '', entryDate: '', exitDate: '' })
  const [showAddTravel, setShowAddTravel] = useState(false)

  useEffect(() => {
    fetch(`/api/clients/${id}`).then(r => r.json()).then(data => {
      setClient(data)
      setTravelHistory(data.travelHistory || [])
      setForm({
        firstName: data.firstName || '', lastName: data.lastName || '',
        previousFirstName: data.previousFirstName || '', previousLastName: data.previousLastName || '',
        maidenName: data.maidenName || '',
        birthDate: data.birthDate?.slice(0,10) || '',
        birthPlace: data.birthPlace || '',
        pesel: data.pesel || '',
        phone: data.phone || '', email: data.email || '',
        citizenship: data.citizenship || '', nationality: data.nationality || '',
        maritalStatus: data.maritalStatus || '', education: data.education || '',
        statusUKR: data.statusUKR || false,
        fatherName: data.fatherName || '', motherName: data.motherName || '',
        motherMaidenName: data.motherMaidenName || '', dependents: data.dependents || '',
        passportSeries: data.passportSeries || '', passportNumber: data.passportNumber || '',
        passportIssuedBy: data.passportIssuedBy || '',
        passportIssuedAt: data.passportIssuedAt?.slice(0,10) || '',
        passportExpiresAt: data.passportExpiresAt?.slice(0,10) || '',
        height: data.height || '', eyeColor: data.eyeColor || '', specialSigns: data.specialSigns || '',
        originCountryAddress: data.originCountryAddress || '',
        previousResidenceAddress: data.previousResidenceAddress || '',
        addressInPoland: data.addressInPoland || '',
        legalTitle: data.legalTitle || '',
        rentalEndDate: data.rentalEndDate?.slice(0,10) || '',
        stayBasis: data.stayBasis || '',
        lastEntryDate: data.lastEntryDate?.slice(0,10) || '',
        firstResidenceCard: data.firstResidenceCard || false,
        residenceCardExpiry: data.residenceCardExpiry?.slice(0,10) || '',
        finesInPoland: data.finesInPoland || false,
        finesDescription: data.finesDescription || '',
      })
    })
  }, [id])

  function set(k: string, v: any) { setForm((p: any) => ({ ...p, [k]: v })) }

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/clients/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const updated = await res.json()
    setClient((prev: any) => ({ ...prev, ...updated }))
    setSaving(false)
  }

  async function deleteClient() {
    if (!confirm(`Удалить клиента "${client.firstName} ${client.lastName}"? Все дела этого клиента также будут удалены. Это действие нельзя отменить.`)) return
    const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/clients')
    } else {
      alert('Ошибка удаления клиента')
    }
  }

  async function addTravel() {
    if (!newTravel.country.trim()) return
    const res = await fetch(`/api/clients/${id}/travel`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTravel),
    })
    const entry = await res.json()
    setTravelHistory(p => [entry, ...p])
    setNewTravel({ country: '', entryDate: '', exitDate: '' })
    setShowAddTravel(false)
  }

  async function removeTravel(travelId: number) {
    await fetch(`/api/clients/${id}/travel/${travelId}`, { method: 'DELETE' })
    setTravelHistory(p => p.filter((t: any) => t.id !== travelId))
  }

  if (!client) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Загрузка...</div>

  const cases = client.cases || []
  const activeCases = cases.filter((c: any) => ['В работе','Ожидание документов','Новый'].includes(c.status))
  const closedCases = cases.filter((c: any) => !['В работе','Ожидание документов','Новый'].includes(c.status))

  // Helpers
  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => router.push(backTo)} className="btn btn-ghost" style={{ padding: '6px 10px' }}>←</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="avatar" style={{ width: 44, height: 44, fontSize: 16 }}>{client.firstName[0]}{client.lastName[0]}</div>
            <div>
              <div className="page-title">{client.firstName} {client.lastName}</div>
              <div className="page-subtitle">{client.phone}{client.email ? ` · ${client.email}` : ''}</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={save} className="btn btn-primary" disabled={saving}>{saving ? 'Сохранение...' : '💾 Сохранить'}</button>
          <Link href={`/cases/new?clientId=${client.id}`} className="btn btn-secondary">+ Новое дело</Link>
          <button onClick={deleteClient} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', color: '#dc2626', fontWeight: 500, fontSize: 13 }}>🗑 Удалить</button>
        </div>
      </div>

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
          <div data-collapsible-scope="client-profile">
            <CollapsibleCardsBehavior scope="client-profile" />
            <SectionVisibilityBehavior scope="client" />

            {/* ── DANE OSOBOWE ── */}
            <div className="card" data-collapse-key="client-personal" data-section-scope="client" data-section-key="client-personal" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>👤</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Данные личные</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Основная информация о клиенте</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <F label="Имя *">
                  <input className="input" value={form.firstName} onChange={e => set('firstName', e.target.value)} />
                </F>
                <F label="Фамилия *">
                  <input className="input" value={form.lastName} onChange={e => set('lastName', e.target.value)} />
                </F>
                <F label="Предыдущее имя">
                  <input className="input" value={form.previousFirstName} onChange={e => set('previousFirstName', e.target.value)} placeholder="Poprzednie imię" />
                </F>
                <F label="Предыдущая фамилия">
                  <input className="input" value={form.previousLastName} onChange={e => set('previousLastName', e.target.value)} placeholder="Poprzednie nazwisko" />
                </F>
                <F label="Девичья фамилия">
                  <input className="input" value={form.maidenName} onChange={e => set('maidenName', e.target.value)} placeholder="Nazwisko panieńskie" />
                </F>
                <F label="Дата рождения">
                  <input className="input" type="date" value={form.birthDate} onChange={e => set('birthDate', e.target.value)} />
                </F>
                <F label="Место рождения">
                  <input className="input" value={form.birthPlace} onChange={e => set('birthPlace', e.target.value)} placeholder="Miasto" />
                </F>
                <F label="PESEL">
                  <input className="input" value={form.pesel} onChange={e => set('pesel', e.target.value)} placeholder="12345678901" style={{ fontFamily: 'monospace' }} />
                </F>
                <F label="Телефон">
                  <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+48111222333" />
                </F>
                <F label="E-mail">
                  <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@example.com" />
                </F>
              </div>
            </div>

            {/* ── СТАТУС И СЕМЬЯ ── */}
            <div className="card" data-collapse-key="client-status-family" data-section-scope="client" data-section-key="client-status-family" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>👨‍👩‍👧</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Статус и семья</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Гражданство, семейное положение и данные семьи</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <F label="Гражданство (Obywatelstwo)">
                  <select className="select" value={form.citizenship} onChange={e => set('citizenship', e.target.value)}>
                    <option value="">Выбрать страну</option>
                    {COUNTRIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </F>
                <F label="Национальность (Narodowość)">
                  <select className="select" value={form.nationality} onChange={e => set('nationality', e.target.value)}>
                    <option value="">Выбрать</option>
                    {COUNTRIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </F>
                <F label="Семейное положение">
                  <select className="select" value={form.maritalStatus} onChange={e => set('maritalStatus', e.target.value)}>
                    <option value="">Выбрать</option>
                    {MARITAL_STATUS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </F>
                <F label="Образование">
                  <select className="select" value={form.education} onChange={e => set('education', e.target.value)}>
                    <option value="">Выбрать</option>
                    {EDUCATION.map(e => <option key={e}>{e}</option>)}
                  </select>
                </F>
                {/* Status UKR */}
                <div style={{ gridColumn: '1/-1' }}>
                  <div
                    onClick={() => set('statusUKR', !form.statusUKR)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', border: `1px solid ${form.statusUKR ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', background: form.statusUKR ? 'rgba(37,99,235,0.06)' : 'var(--bg)', transition: 'all 0.15s' }}
                  >
                    <input type="checkbox" checked={form.statusUKR} onChange={() => {}} style={{ width: 18, height: 18, accentColor: 'var(--brand)' }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>Status UKR</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Клиент имеет статус беженца из Украины</div>
                    </div>
                  </div>
                </div>
                {/* Семья */}
                <div style={{ gridColumn: '1/-1', paddingTop: 8, borderTop: '1px solid var(--border)', marginTop: 4 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: 'var(--text)' }}>Семья</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <F label="Имя отца">
                      <input className="input" value={form.fatherName} onChange={e => set('fatherName', e.target.value)} placeholder="Imię ojca" />
                    </F>
                    <F label="Имя матери">
                      <input className="input" value={form.motherName} onChange={e => set('motherName', e.target.value)} placeholder="Imię matki" />
                    </F>
                    <F label="Девичья фамилия матери" col>
                      <input className="input" value={form.motherMaidenName} onChange={e => set('motherMaidenName', e.target.value)} placeholder="Nazwisko panieńskie matki" />
                    </F>
                    <F label="Лица на содержании" col>
                      <textarea className="input" value={form.dependents} onChange={e => set('dependents', e.target.value)} rows={2} placeholder="Informacje o osobach na utrzymaniu..." />
                    </F>
                  </div>
                </div>
              </div>
            </div>

            {/* ── ПАСПОРТНЫЕ ДАННЫЕ + ФИЗИЧЕСКИЕ ПРИЗНАКИ ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div className="card" data-collapse-key="client-passport" data-section-scope="client" data-section-key="client-passport">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📋</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>Паспортные данные</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Informacje z paszportu</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <F label="Серия и номер">
                    <input className="input" value={form.passportSeries} onChange={e => set('passportSeries', e.target.value)} placeholder="AB123456" style={{ fontFamily: 'monospace' }} />
                  </F>
                  <F label="Выдан кем">
                    <input className="input" value={form.passportIssuedBy} onChange={e => set('passportIssuedBy', e.target.value)} />
                  </F>
                  <F label="Дата выдачи">
                    <input className="input" type="date" value={form.passportIssuedAt} onChange={e => set('passportIssuedAt', e.target.value)} />
                  </F>
                  <F label="Действует до">
                    <input className="input" type="date" value={form.passportExpiresAt} onChange={e => set('passportExpiresAt', e.target.value)} />
                  </F>
                </div>
                {form.passportExpiresAt && (
                  <div style={{ marginTop: 8, fontSize: 12, color: new Date(form.passportExpiresAt) < new Date(Date.now() + 90*24*60*60*1000) ? '#dc2626' : '#16a34a', fontWeight: 500 }}>
                    {new Date(form.passportExpiresAt) < new Date() ? '⚠️ Паспорт просрочен' :
                     new Date(form.passportExpiresAt) < new Date(Date.now() + 90*24*60*60*1000) ? '⚠️ Паспорт истекает менее чем через 90 дней' :
                     '✅ Паспорт действителен'}
                  </div>
                )}
              </div>

              <div className="card" data-collapse-key="client-physical" data-section-scope="client" data-section-key="client-physical">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>👁</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>Физические признаки</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Cechy zewnętrzne do dokumentów</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <F label="Рост (см)">
                    <input className="input" type="number" value={form.height} onChange={e => set('height', e.target.value)} placeholder="175" />
                  </F>
                  <F label="Цвет глаз">
                    <select className="select" value={form.eyeColor} onChange={e => set('eyeColor', e.target.value)}>
                      <option value="">Выбрать</option>
                      {EYE_COLORS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </F>
                  <F label="Особые приметы" col>
                    <textarea className="input" value={form.specialSigns} onChange={e => set('specialSigns', e.target.value)} rows={3} placeholder="Татуировки, шрамы и т.д." />
                  </F>
                </div>
              </div>
            </div>

            <div className="card" data-collapse-key="client-origin-address" data-section-scope="client" data-section-key="client-origin-address" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ecfeff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏠</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Адрес проживания в стране происхождения</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Адрес, где клиент проживал до переезда</div>
                </div>
              </div>
              <F label="Адрес проживания в стране происхождения" col>
                <textarea className="input" value={form.originCountryAddress} onChange={e => set('originCountryAddress', e.target.value)} rows={3} placeholder="Страна, город, улица, дом, квартира..." />
              </F>
            </div>

            <div className="card" data-collapse-key="client-previous-residence-address" data-section-scope="client" data-section-key="client-previous-residence-address" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🌍</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Адрес в стране предыдущего проживания</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>При условии проживания 365 дней +</div>
                </div>
              </div>
              <F label="Адрес в стране предыдущего проживания (365 дней +)" col>
                <textarea className="input" value={form.previousResidenceAddress} onChange={e => set('previousResidenceAddress', e.target.value)} rows={3} placeholder="Страна, город, улица, дом, квартира..." />
              </F>
            </div>

            {/* ── ПРЕБЫВАНИЕ В ПОЛЬШЕ ── */}
            <div className="card" data-collapse-key="client-poland-stay" data-section-scope="client" data-section-key="client-poland-stay" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📍</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Пребывание в Польше</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Adres, podstawa pobytu i karta pobytu</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <F label="Адрес в Польше" col>
                  <textarea className="input" value={form.addressInPoland} onChange={e => set('addressInPoland', e.target.value)} rows={2} placeholder="ul. Przykładowa 1/2, 00-000 Warszawa" />
                </F>
                <F label="Правовой титул на жильё">
                  <select className="select" value={form.legalTitle} onChange={e => { set('legalTitle', e.target.value); if (!e.target.value.includes('Wynajem')) set('rentalEndDate', '') }}>
                    <option value="">Выбрать</option>
                    {LEGAL_TITLE.map(l => <option key={l}>{l}</option>)}
                  </select>
                </F>
                {form.legalTitle?.includes('Wynajem') && (
                  <F label="Конец аренды">
                    <input className="input" type="date" value={form.rentalEndDate} onChange={e => set('rentalEndDate', e.target.value)} />
                  </F>
                )}
                <F label="Основание пребывания">
                  <select className="select" value={form.stayBasis} onChange={e => set('stayBasis', e.target.value)}>
                    <option value="">Выбрать</option>
                    {STAY_BASIS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </F>
                <F label="Дата последнего въезда">
                  <input className="input" type="date" value={form.lastEntryDate} onChange={e => set('lastEntryDate', e.target.value)} />
                </F>

                {/* Карта побыту */}
                <div style={{ gridColumn: '1/-1', paddingTop: 8, borderTop: '1px solid var(--border)', marginTop: 4 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Карта пребывания (Karta pobytu)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ gridColumn: '1/-1' }}>
                      <div
                        onClick={() => { set('firstResidenceCard', !form.firstResidenceCard); if (!form.firstResidenceCard) set('residenceCardExpiry', '') }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: `1px solid ${form.firstResidenceCard ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', background: form.firstResidenceCard ? 'rgba(37,99,235,0.06)' : 'var(--bg)' }}
                      >
                        <input type="checkbox" checked={form.firstResidenceCard} onChange={() => {}} style={{ width: 17, height: 17, accentColor: 'var(--brand)' }} />
                        <span style={{ fontSize: 13, fontWeight: 500 }}>Первая карта пребывания (Pierwsza karta pobytu)</span>
                      </div>
                    </div>
                    {!form.firstResidenceCard && (
                      <F label="Срок действия карты">
                        <input className="input" type="date" value={form.residenceCardExpiry} onChange={e => set('residenceCardExpiry', e.target.value)} />
                      </F>
                    )}
                  </div>
                </div>

                {/* Штрафы */}
                <div style={{ gridColumn: '1/-1', paddingTop: 8, borderTop: '1px solid var(--border)', marginTop: 4 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Штрафы (Mandaty)</div>
                  <div
                    onClick={() => set('finesInPoland', !form.finesInPoland)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: `1px solid ${form.finesInPoland ? '#dc2626' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', background: form.finesInPoland ? '#fef2f2' : 'var(--bg)' }}
                  >
                    <input type="checkbox" checked={form.finesInPoland} onChange={() => {}} style={{ width: 17, height: 17 }} />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>Были штрафы в Польше (Mandaty w Polsce)</span>
                  </div>
                  {form.finesInPoland && (
                    <div style={{ marginTop: 10 }}>
                      <textarea className="input" value={form.finesDescription} onChange={e => set('finesDescription', e.target.value)} rows={2} placeholder="Опишите штрафы..." />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── ИСТОРИЯ ПУТЕШЕСТВИЙ ── */}
            <div className="card" data-collapse-key="client-travel-history" data-section-scope="client" data-section-key="client-travel-history">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✈️</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>История путешествий</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Wyjazdy zagraniczne i pobyty</div>
                  </div>
                </div>
                <button onClick={() => setShowAddTravel(v => !v)} className="btn btn-primary" style={{ fontSize: 13 }}>+ Добавить</button>
              </div>

              {showAddTravel && (
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 14, marginBottom: 14, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div className="form-group">
                      <label className="label">Страна *</label>
                      <input className="input" value={newTravel.country} onChange={e => setNewTravel(p => ({ ...p, country: e.target.value }))} placeholder="Украина" />
                    </div>
                    <div className="form-group">
                      <label className="label">Дата въезда</label>
                      <input className="input" type="date" value={newTravel.entryDate} onChange={e => setNewTravel(p => ({ ...p, entryDate: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="label">Дата выезда</label>
                      <input className="input" type="date" value={newTravel.exitDate} onChange={e => setNewTravel(p => ({ ...p, exitDate: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={addTravel} className="btn btn-primary" disabled={!newTravel.country.trim()}>Добавить</button>
                    <button onClick={() => setShowAddTravel(false)} className="btn btn-secondary">Отмена</button>
                  </div>
                </div>
              )}

              {travelHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted)' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>✈️</div>
                  <div style={{ fontSize: 13 }}>Нет записей о путешествиях</div>
                  <button onClick={() => setShowAddTravel(true)} className="btn btn-secondary" style={{ marginTop: 10, fontSize: 12 }}>Добавить первую запись</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {travelHistory.map((t: any) => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 18 }}>🌍</span>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{t.country}</span>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                          {t.entryDate && `Въезд: ${new Date(t.entryDate).toLocaleDateString('ru')}`}
                          {t.entryDate && t.exitDate && ' → '}
                          {t.exitDate && `Выезд: ${new Date(t.exitDate).toLocaleDateString('ru')}`}
                        </div>
                      </div>
                      <button onClick={() => removeTravel(t.id)} style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 12, color: '#dc2626' }}>🗑</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* ── БОКОВАЯ ПАНЕЛЬ ── */}
          <div>
            {/* Активные дела */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title"><span>⚡</span>Активные дела ({activeCases.length})</div>
              {activeCases.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>Нет активных дел</div>
              ) : activeCases.map((c: any) => {
                const sc = STATUS_COLORS[c.status] || { bg: '#f3f4f6', color: '#374151' }
                return (
                  <Link key={c.id} href={`/cases/${c.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        {c.service && <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.service.color || '#3b82f6', flexShrink: 0 }} />}
                        <span style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>{c.service?.name || c.caseNumber}</span>
                        <span className="badge" style={{ background: sc.bg, color: sc.color, fontSize: 10 }}>{c.status}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{c.caseNumber}</div>
                    </div>
                  </Link>
                )
              })}
              <Link href={`/cases/new?clientId=${client.id}`} className="btn btn-primary" style={{ marginTop: 10, width: '100%', justifyContent: 'center', fontSize: 12 }}>
                + Новое дело
              </Link>
            </div>

            {/* Закрытые дела */}
            {closedCases.length > 0 && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="section-title"><span>📁</span>Закрытые дела ({closedCases.length})</div>
                {closedCases.map((c: any) => {
                  const sc = STATUS_COLORS[c.status] || { bg: '#f3f4f6', color: '#374151' }
                  return (
                    <Link key={c.id} href={`/cases/${c.id}`} style={{ textDecoration: 'none' }}>
                      <div style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', opacity: 0.7 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 11, flex: 1, color: 'var(--text)' }}>{c.service?.name || c.caseNumber}</span>
                          <span className="badge" style={{ background: sc.bg, color: sc.color, fontSize: 10 }}>{c.status}</span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}

            {/* Инфо */}
            <div className="card">
              <div className="section-title"><span>ℹ️</span>Информация</div>
              <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  ['Создано', new Date(client.createdAt).toLocaleDateString('ru')],
                  ['Обновлено', new Date(client.updatedAt).toLocaleDateString('ru')],
                  client.citizenship && ['Гражданство', client.citizenship],
                  client.branch && ['Отдел', client.branch],
                ].filter(Boolean).map(([label, value]: any) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>{label}</span>
                    <span style={{ fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <CustomSectionsRenderer scope="client" recordId={String(id)} />
          </div>
        </div>
      </div>
    </div>
  )
}
