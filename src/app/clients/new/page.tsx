'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PhoneListEditor, { ensurePhoneRows } from '@/components/PhoneListEditor'
import { useLanguage } from '@/context/LanguageContext'

const EYE_COLOR_OPTIONS = [
  { value: 'Карие', labelKey: 'brown_eyes' },
  { value: 'Зелёные', labelKey: 'green_eyes' },
  { value: 'Голубые', labelKey: 'blue_eyes' },
  { value: 'Серые', labelKey: 'gray_eyes' },
  { value: 'Чёрные', labelKey: 'black_eyes' },
]

const STAY_BASIS_OPTIONS = [
  { value: 'Трудоустройство', labelKey: 'employment' },
  { value: 'Воссоединение семьи', labelKey: 'family_reunification' },
  { value: 'Обучение', labelKey: 'study' },
  { value: 'Бизнес', labelKey: 'business' },
  { value: 'Временная защита', labelKey: 'temporary_protection' },
  { value: 'Другое', labelKey: 'other' },
]

export default function NewClientPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', phones: ensurePhoneRows([], ''), email: '', city: '', pesel: '',
    passportSeries: '', passportNumber: '', passportIssuedBy: '',
    passportIssuedAt: '', passportExpiresAt: '',
    addressInPoland: '', stayBasis: '',
    motherMaidenName: '', dependents: '',
    height: '', eyeColor: '', specialSigns: '',
  })

  function set(k: string) {
    return function(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
      setForm(prev => ({ ...prev, [k]: e.target.value }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error || t('client_create_failed'))
      else router.push(`/clients/${data.id}`)
    } catch {
      setError(t('connection_error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">{t('new_client_title')}</div>
          <div className="page-subtitle">{t('new_client_subtitle')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => router.back()} className="btn btn-secondary">{t('cancel')}</button>
          <button type="button" onClick={handleSubmit} className="btn btn-primary" disabled={loading}>
            {loading ? t('saving') : t('save')}
          </button>
        </div>
      </div>

      <div className="page-body">
        {error && <div className="error-msg">{error}</div>}

        {/* Личные данные */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title"><span>👤</span>{t('personal_data')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="label">{t('first_name')} *</label>
              <input className="input" type="text" value={form.firstName} onChange={set('firstName')} required />
            </div>
            <div className="form-group">
              <label className="label">{t('last_name')} *</label>
              <input className="input" type="text" value={form.lastName} onChange={set('lastName')} required />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="label">{t('phone')}</label>
              <PhoneListEditor
                phones={form.phones}
                onChange={phones => {
                  const primary = phones.find(item => item.isPrimary)?.phone || phones[0]?.phone || ''
                  setForm(prev => ({ ...prev, phones, phone: primary }))
                }}
              />
            </div>
            <div className="form-group">
              <label className="label">{t('email')}</label>
              <input className="input" type="email" value={form.email} onChange={set('email')} />
            </div>
            <div className="form-group">
              <label className="label">{t('city')}</label>
              <input className="input" type="text" value={form.city} onChange={set('city')} />
            </div>
            <div className="form-group">
              <label className="label">PESEL</label>
              <input className="input" type="text" value={form.pesel} onChange={set('pesel')} />
            </div>
            <div className="form-group">
              <label className="label">{t('mother_maiden_name')}</label>
              <input className="input" type="text" value={form.motherMaidenName} onChange={set('motherMaidenName')} />
            </div>
            <div className="form-group">
              <label className="label">{t('dependents')}</label>
              <textarea className="input" value={form.dependents} onChange={set('dependents')} rows={2} placeholder={t('dependents_placeholder')} />
            </div>
          </div>
        </div>

        {/* Паспортные данные */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title"><span>📘</span>{t('passport_data')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="label">{t('series')}</label>
              <input className="input" type="text" value={form.passportSeries} onChange={set('passportSeries')} />
            </div>
            <div className="form-group">
              <label className="label">{t('number')}</label>
              <input className="input" type="text" value={form.passportNumber} onChange={set('passportNumber')} />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="label">{t('issued_by')}</label>
              <input className="input" type="text" value={form.passportIssuedBy} onChange={set('passportIssuedBy')} />
            </div>
            <div className="form-group">
              <label className="label">{t('issued_at')}</label>
              <input className="input" type="date" value={form.passportIssuedAt} onChange={set('passportIssuedAt')} />
            </div>
            <div className="form-group">
              <label className="label">{t('valid_until')}</label>
              <input className="input" type="date" value={form.passportExpiresAt} onChange={set('passportExpiresAt')} />
            </div>
          </div>
        </div>

        {/* Физические характеристики */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title"><span>📏</span>{t('physical_features')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="label">{t('height_cm')}</label>
              <input className="input" type="number" value={form.height} onChange={set('height')} />
            </div>
            <div className="form-group">
              <label className="label">{t('eye_color')}</label>
              <select className="select" value={form.eyeColor} onChange={set('eyeColor')}>
                <option value="">{t('choose')}</option>
                {EYE_COLOR_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="label">{t('special_signs')}</label>
              <textarea className="input" value={form.specialSigns} onChange={set('specialSigns')} rows={2} />
            </div>
          </div>
        </div>

        {/* Пребывание в Польше */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title"><span>🏠</span>{t('stay_in_poland')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="label">{t('address')}</label>
              <input className="input" type="text" value={form.addressInPoland} onChange={set('addressInPoland')} />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="label">{t('stay_basis')}</label>
              <select className="select" value={form.stayBasis} onChange={set('stayBasis')}>
                <option value="">{t('choose')}</option>
                {STAY_BASIS_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
