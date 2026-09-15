'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Lang } from '@/lib/translations'

export type BulkActionPayload =
  | { action: 'assign_employee'; employeeId: number }
  | { action: 'unassign_employee' }
  | { action: 'change_status'; statusId: number; statusReason?: string; statusReasonComment?: string }

type BulkEntity = 'leads' | 'cases'

type Props = {
  entity: BulkEntity
  lang: Lang
  selectedCount: number
  currentPageCount: number
  filteredCount: number
  allCurrentPageSelected: boolean
  allFilteredSelected: boolean
  selectionDescription: string
  employees: Array<{ id: number; name: string; active?: boolean }>
  statuses: Array<{ id: number; name: string; color?: string; requireReason?: boolean; reasons?: unknown }>
  statusLabel: (name: string) => string
  allowedActions?: BulkActionPayload['action'][]
  onSelectAllFiltered: () => void
  onClear: () => void
  onApply: (payload: BulkActionPayload) => Promise<{ updated: number }>
}

const COPY = {
  ru: {
    selected: 'выбрано', actions: 'Действия', clear: 'Снять выбор', assign: 'Назначить ответственного',
    unassign: 'Снять ответственного', status: 'Изменить статус', search: 'Поиск сотрудника', noEmployees: 'Сотрудники не найдены',
    chooseStatus: 'Выберите статус', reason: 'Причина смены статуса', comment: 'Комментарий', cancel: 'Отмена', confirm: 'Подтвердить',
    pageSelected: (count: number) => `Выбрано ${count} на этой странице.`, allLeads: (count: number) => `Выбрать все ${count} найденных лидов?`,
    allCases: (count: number) => `Выбрать все ${count} найденных дел?`, allSelected: (count: number) => `Выбраны все ${count} найденных записей.`,
    assignConfirm: (name: string, count: number, entity: BulkEntity) => `Назначить ${name} ответственным для ${count} ${entity === 'leads' ? 'лидов' : 'дел'}?`,
    unassignConfirm: (count: number, entity: BulkEntity) => `Снять ответственного для ${count} ${entity === 'leads' ? 'лидов' : 'дел'}?`,
    statusConfirm: (count: number, name: string, entity: BulkEntity) => `Изменить статус ${count} ${entity === 'leads' ? 'лидов' : 'дел'} на «${name}»?`,
    large: (count: number) => `Действие будет применено ко всем ${count} записям текущего фильтра.`,
    updating: (count: number, entity: BulkEntity) => `Обновление ${count} ${entity === 'leads' ? 'лидов' : 'дел'}...`,
    responsibleDone: (count: number, entity: BulkEntity) => `Ответственный изменён для ${count} ${entity === 'leads' ? 'лидов' : 'дел'}`,
    statusDone: (count: number, entity: BulkEntity) => `Статус изменён для ${count} ${entity === 'leads' ? 'лидов' : 'дел'}`,
  },
  uk: {
    selected: 'вибрано', actions: 'Дії', clear: 'Скасувати вибір', assign: 'Призначити відповідального',
    unassign: 'Зняти відповідального', status: 'Змінити статус', search: 'Пошук співробітника', noEmployees: 'Співробітників не знайдено',
    chooseStatus: 'Оберіть статус', reason: 'Причина зміни статусу', comment: 'Коментар', cancel: 'Скасувати', confirm: 'Підтвердити',
    pageSelected: (count: number) => `Вибрано ${count} на цій сторінці.`, allLeads: (count: number) => `Вибрати всі ${count} знайдених лідів?`,
    allCases: (count: number) => `Вибрати всі ${count} знайдених справ?`, allSelected: (count: number) => `Вибрано всі ${count} знайдених записів.`,
    assignConfirm: (name: string, count: number, entity: BulkEntity) => `Призначити ${name} відповідальним для ${count} ${entity === 'leads' ? 'лідів' : 'справ'}?`,
    unassignConfirm: (count: number, entity: BulkEntity) => `Зняти відповідального для ${count} ${entity === 'leads' ? 'лідів' : 'справ'}?`,
    statusConfirm: (count: number, name: string, entity: BulkEntity) => `Змінити статус ${count} ${entity === 'leads' ? 'лідів' : 'справ'} на «${name}»?`,
    large: (count: number) => `Дію буде застосовано до всіх ${count} записів, що відповідають поточному фільтру.`,
    updating: (count: number, entity: BulkEntity) => `Оновлення ${count} ${entity === 'leads' ? 'лідів' : 'справ'}...`,
    responsibleDone: (count: number, entity: BulkEntity) => `Відповідального змінено для ${count} ${entity === 'leads' ? 'лідів' : 'справ'}`,
    statusDone: (count: number, entity: BulkEntity) => `Статус змінено для ${count} ${entity === 'leads' ? 'лідів' : 'справ'}`,
  },
  pl: {
    selected: 'wybrano', actions: 'Działania', clear: 'Wyczyść wybór', assign: 'Przypisz odpowiedzialnego',
    unassign: 'Usuń odpowiedzialnego', status: 'Zmień status', search: 'Szukaj pracownika', noEmployees: 'Nie znaleziono pracowników',
    chooseStatus: 'Wybierz status', reason: 'Powód zmiany statusu', comment: 'Komentarz', cancel: 'Anuluj', confirm: 'Potwierdź',
    pageSelected: (count: number) => `Wybrano ${count} na tej stronie.`, allLeads: (count: number) => `Wybrać wszystkie ${count} znalezione leady?`,
    allCases: (count: number) => `Wybrać wszystkie ${count} znalezione sprawy?`, allSelected: (count: number) => `Wybrano wszystkie ${count} znalezione rekordy.`,
    assignConfirm: (name: string, count: number, entity: BulkEntity) => `Przypisać ${name} jako odpowiedzialnego dla ${count} ${entity === 'leads' ? 'leadów' : 'spraw'}?`,
    unassignConfirm: (count: number, entity: BulkEntity) => `Usunąć odpowiedzialnego dla ${count} ${entity === 'leads' ? 'leadów' : 'spraw'}?`,
    statusConfirm: (count: number, name: string, entity: BulkEntity) => `Zmienić status ${count} ${entity === 'leads' ? 'leadów' : 'spraw'} na „${name}”?`,
    large: (count: number) => `Działanie zostanie zastosowane do wszystkich ${count} rekordów bieżącego filtra.`,
    updating: (count: number, entity: BulkEntity) => `Aktualizacja ${count} ${entity === 'leads' ? 'leadów' : 'spraw'}...`,
    responsibleDone: (count: number, entity: BulkEntity) => `Zmieniono odpowiedzialnego dla ${count} ${entity === 'leads' ? 'leadów' : 'spraw'}`,
    statusDone: (count: number, entity: BulkEntity) => `Zmieniono status dla ${count} ${entity === 'leads' ? 'leadów' : 'spraw'}`,
  },
}

export default function BulkActionsBar(props: Props) {
  const copy = COPY[props.lang] || COPY.ru
  const allowedActions = props.allowedActions || ['assign_employee', 'change_status', 'unassign_employee']
  const [menuOpen, setMenuOpen] = useState(false)
  const [modalAction, setModalAction] = useState<BulkActionPayload['action'] | null>(null)
  const [employeeQuery, setEmployeeQuery] = useState('')
  const [employeeId, setEmployeeId] = useState<number | null>(null)
  const [statusId, setStatusId] = useState<number | null>(null)
  const [statusReason, setStatusReason] = useState('')
  const [statusReasonComment, setStatusReasonComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 3500)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const visibleEmployees = useMemo(() => {
    const query = employeeQuery.trim().toLowerCase()
    return props.employees.filter(employee => employee.active !== false && (!query || employee.name.toLowerCase().includes(query)))
  }, [props.employees, employeeQuery])
  const selectedEmployee = props.employees.find(employee => employee.id === employeeId)
  const selectedStatus = props.statuses.find(status => status.id === statusId)
  const reasons = Array.isArray(selectedStatus?.reasons)
    ? selectedStatus.reasons.map(item => String(item || '').trim()).filter(Boolean)
    : []

  function openAction(action: BulkActionPayload['action']) {
    setMenuOpen(false)
    setModalAction(action)
    setEmployeeQuery('')
    setEmployeeId(null)
    setStatusId(null)
    setStatusReason('')
    setStatusReasonComment('')
    setError('')
  }

  function closeModal() {
    if (saving) return
    setModalAction(null)
    setError('')
  }

  const confirmation = modalAction === 'assign_employee' && selectedEmployee
    ? copy.assignConfirm(selectedEmployee.name, props.selectedCount, props.entity)
    : modalAction === 'unassign_employee'
      ? copy.unassignConfirm(props.selectedCount, props.entity)
      : modalAction === 'change_status' && selectedStatus
        ? copy.statusConfirm(props.selectedCount, props.statusLabel(selectedStatus.name), props.entity)
        : ''

  const canConfirm = modalAction === 'unassign_employee'
    || (modalAction === 'assign_employee' && Boolean(employeeId))
    || (modalAction === 'change_status' && Boolean(statusId) && (!selectedStatus?.requireReason || Boolean(statusReason)))

  async function apply() {
    if (!modalAction || !canConfirm) return
    const payload: BulkActionPayload = modalAction === 'assign_employee'
      ? { action: modalAction, employeeId: employeeId as number }
      : modalAction === 'change_status'
        ? { action: modalAction, statusId: statusId as number, statusReason, statusReasonComment }
        : { action: modalAction }
    setSaving(true)
    setError('')
    try {
      const result = await props.onApply(payload)
      const count = result.updated
      setToast(modalAction === 'change_status'
        ? copy.statusDone(count, props.entity)
        : copy.responsibleDone(count, props.entity))
      setModalAction(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Bulk update failed')
    } finally {
      setSaving(false)
    }
  }

  const selectAllPrompt = props.selectedCount > 0
    && props.allCurrentPageSelected
    && !props.allFilteredSelected
    && props.filteredCount > props.currentPageCount

  return (
    <>
      {props.selectedCount > 0 && (
        <div className="bulk-actions-shell" aria-live="polite">
          <div className="bulk-actions-row">
            <strong className="bulk-actions-count">{props.selectedCount} {copy.selected}</strong>
            <div ref={menuRef} className="bulk-actions-menu-wrap">
              <button type="button" className="btn btn-primary bulk-actions-trigger" disabled={saving} onClick={() => setMenuOpen(value => !value)}>
                {copy.actions} <span aria-hidden="true">▾</span>
              </button>
              {menuOpen && (
                <div className="bulk-actions-menu" role="menu">
                  {allowedActions.includes('assign_employee') && <button type="button" role="menuitem" onClick={() => openAction('assign_employee')}>👤 {copy.assign}</button>}
                  {allowedActions.includes('change_status') && <button type="button" role="menuitem" onClick={() => openAction('change_status')}>● {copy.status}</button>}
                  {allowedActions.includes('unassign_employee') && (
                    <>
                      {allowedActions.some(action => action !== 'unassign_employee') && <div className="bulk-actions-separator" />}
                      <button type="button" role="menuitem" onClick={() => openAction('unassign_employee')}>⊘ {copy.unassign}</button>
                    </>
                  )}
                </div>
              )}
            </div>
            <button type="button" className="btn btn-secondary bulk-actions-clear" disabled={saving} onClick={props.onClear}>× {copy.clear}</button>
            {saving && <span className="bulk-actions-progress">{copy.updating(props.selectedCount, props.entity)}</span>}
          </div>
          {selectAllPrompt && (
            <div className="bulk-select-all-prompt">
              <span>{copy.pageSelected(props.currentPageCount)}</span>
              <button type="button" onClick={props.onSelectAllFiltered}>
                {props.entity === 'leads' ? copy.allLeads(props.filteredCount) : copy.allCases(props.filteredCount)}
              </button>
            </div>
          )}
          {props.allFilteredSelected && (
            <div className="bulk-selection-summary">
              <strong>{copy.allSelected(props.selectedCount)}</strong>
              {props.selectionDescription && <span>{props.selectionDescription}</span>}
            </div>
          )}
        </div>
      )}

      {modalAction && (
        <div className="bulk-modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && closeModal()}>
          <div className="bulk-modal" role="dialog" aria-modal="true" aria-label={copy.actions}>
            <div className="bulk-modal-head">
              <strong>{modalAction === 'assign_employee' ? copy.assign : modalAction === 'change_status' ? copy.status : copy.unassign}</strong>
              <button type="button" onClick={closeModal} aria-label={copy.cancel}>×</button>
            </div>

            {modalAction === 'assign_employee' && (
              <>
                <input className="input" autoFocus placeholder={`🔍 ${copy.search}`} value={employeeQuery} onChange={event => setEmployeeQuery(event.target.value)} />
                <div className="bulk-choice-list">
                  {visibleEmployees.map(employee => (
                    <button key={employee.id} type="button" className={employeeId === employee.id ? 'is-selected' : ''} onClick={() => setEmployeeId(employee.id)}>
                      <span className="bulk-avatar">{employee.name.slice(0, 1).toUpperCase()}</span>
                      <span>{employee.name}</span>
                      {employeeId === employee.id && <span className="bulk-check">✓</span>}
                    </button>
                  ))}
                  {!visibleEmployees.length && <div className="bulk-empty">{copy.noEmployees}</div>}
                </div>
              </>
            )}

            {modalAction === 'change_status' && (
              <>
                <label className="bulk-field-label">{copy.chooseStatus}</label>
                <div className="bulk-choice-list bulk-status-list">
                  {props.statuses.map(status => (
                    <button key={status.id} type="button" className={statusId === status.id ? 'is-selected' : ''} onClick={() => { setStatusId(status.id); setStatusReason(''); setStatusReasonComment('') }}>
                      <span className="bulk-status-dot" style={{ background: status.color || '#2563eb' }} />
                      <span>{props.statusLabel(status.name)}</span>
                      {statusId === status.id && <span className="bulk-check">✓</span>}
                    </button>
                  ))}
                </div>
                {selectedStatus?.requireReason && (
                  <div className="bulk-reason-fields">
                    <label className="bulk-field-label">{copy.reason}</label>
                    {reasons.length ? (
                      <select className="select" value={statusReason} onChange={event => setStatusReason(event.target.value)}>
                        <option value="">—</option>
                        {reasons.map(reason => <option key={reason} value={reason}>{reason}</option>)}
                      </select>
                    ) : (
                      <input className="input" value={statusReason} onChange={event => setStatusReason(event.target.value)} />
                    )}
                    <label className="bulk-field-label">{copy.comment}</label>
                    <textarea className="input" rows={3} value={statusReasonComment} onChange={event => setStatusReasonComment(event.target.value)} />
                  </div>
                )}
              </>
            )}

            {confirmation && <div className="bulk-confirmation"><strong>{confirmation}</strong></div>}
            {props.selectedCount >= 100 && <div className="bulk-large-warning">⚠ {copy.large(props.selectedCount)}</div>}
            {error && <div className="bulk-error">{error}</div>}
            <div className="bulk-modal-actions">
              <button type="button" className="btn btn-secondary" disabled={saving} onClick={closeModal}>{copy.cancel}</button>
              <button type="button" className="btn btn-primary" disabled={saving || !canConfirm} onClick={apply}>
                {saving ? copy.updating(props.selectedCount, props.entity) : copy.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="bulk-toast" role="status">✓ {toast}</div>}

      <style jsx>{`
        .bulk-actions-shell { margin-bottom: 14px; padding: 10px 12px; border: 1px solid color-mix(in srgb, var(--brand) 35%, var(--border)); border-radius: 12px; background: color-mix(in srgb, var(--brand) 7%, var(--surface)); box-shadow: 0 8px 24px rgba(15, 23, 42, .06); }
        .bulk-actions-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .bulk-actions-count { color: var(--text); white-space: nowrap; }
        .bulk-actions-menu-wrap { position: relative; }
        .bulk-actions-trigger { min-width: 108px; justify-content: center; }
        .bulk-actions-menu { position: absolute; top: calc(100% + 6px); left: 0; z-index: 80; width: 260px; padding: 6px; border: 1px solid var(--border); border-radius: 11px; background: var(--surface); box-shadow: 0 18px 44px rgba(15, 23, 42, .18); }
        .bulk-actions-menu button { width: 100%; padding: 9px 10px; border: 0; border-radius: 7px; background: transparent; color: var(--text); text-align: left; cursor: pointer; font-weight: 600; }
        .bulk-actions-menu button:hover { background: var(--bg); }
        .bulk-actions-separator { height: 1px; margin: 5px 4px; background: var(--border); }
        .bulk-actions-progress { color: var(--muted); font-size: 13px; }
        .bulk-select-all-prompt, .bulk-selection-summary { display: flex; align-items: center; gap: 7px; margin-top: 9px; padding-top: 9px; border-top: 1px solid var(--border); font-size: 13px; flex-wrap: wrap; }
        .bulk-select-all-prompt button { border: 0; background: transparent; color: var(--brand); font: inherit; font-weight: 800; cursor: pointer; padding: 0; }
        .bulk-selection-summary span { color: var(--muted); }
        .bulk-modal-backdrop { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 18px; background: rgba(2, 10, 24, .58); backdrop-filter: blur(3px); }
        .bulk-modal { width: min(520px, 100%); max-height: min(720px, 88vh); overflow: auto; padding: 18px; border: 1px solid var(--border); border-radius: 15px; background: var(--surface); color: var(--text); box-shadow: 0 28px 90px rgba(0, 0, 0, .3); }
        .bulk-modal-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; font-size: 17px; }
        .bulk-modal-head button { width: 30px; height: 30px; border: 0; border-radius: 8px; background: var(--bg); color: var(--muted); cursor: pointer; font-size: 20px; }
        .bulk-choice-list { display: grid; gap: 5px; max-height: 260px; overflow: auto; margin-top: 10px; }
        .bulk-choice-list button { display: flex; align-items: center; gap: 9px; width: 100%; padding: 9px; border: 1px solid transparent; border-radius: 9px; background: var(--bg); color: var(--text); text-align: left; cursor: pointer; }
        .bulk-choice-list button.is-selected { border-color: var(--brand); background: color-mix(in srgb, var(--brand) 9%, var(--surface)); }
        .bulk-avatar { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; color: white; background: var(--brand); font-weight: 800; }
        .bulk-check { margin-left: auto; color: var(--brand); font-weight: 900; }
        .bulk-status-dot { width: 10px; height: 10px; border-radius: 50%; flex: 0 0 auto; }
        .bulk-empty { padding: 16px; text-align: center; color: var(--muted); }
        .bulk-field-label { display: block; margin: 12px 0 6px; color: var(--muted); font-size: 12px; font-weight: 700; }
        .bulk-reason-fields { margin-top: 12px; }
        .bulk-confirmation { margin-top: 15px; padding: 12px; border-radius: 10px; background: var(--bg); line-height: 1.45; }
        .bulk-large-warning { margin-top: 10px; padding: 11px 12px; border: 1px solid #f59e0b; border-radius: 10px; background: #fffbeb; color: #92400e; font-size: 13px; font-weight: 700; }
        .bulk-error { margin-top: 10px; color: #dc2626; font-size: 13px; font-weight: 700; }
        .bulk-modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
        .bulk-toast { position: fixed; right: 24px; bottom: 24px; z-index: 1200; max-width: min(420px, calc(100vw - 32px)); padding: 12px 16px; border-radius: 11px; background: #047857; color: white; box-shadow: 0 16px 45px rgba(0, 0, 0, .24); font-weight: 700; }
        @media (max-width: 640px) {
          .bulk-actions-clear { padding-inline: 10px; }
          .bulk-actions-progress { width: 100%; }
          .bulk-modal { padding: 15px; }
          .bulk-toast { right: 16px; bottom: 16px; }
        }
      `}</style>
    </>
  )
}
