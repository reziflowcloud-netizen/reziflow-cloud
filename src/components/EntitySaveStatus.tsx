'use client'
import type { EntityAutosave } from '@/lib/caseAutosave'
import { appExperienceText } from '@/lib/appExperienceI18n'
import type { Lang } from '@/lib/translations'
export default function EntitySaveStatus({ engine, lang, reload }: { engine: EntityAutosave; lang: Lang; reload: () => void }) {
  const copy = appExperienceText[lang]
  return <div className="case-save-status" data-state={engine.state} role="status" aria-live="polite">
    {engine.state === 'idle' || engine.state === 'dirty' ? '' : copy[engine.state]}
    {engine.state === 'error' && <button type="button" className="btn btn-secondary" onClick={() => void engine.flush(true)}>{copy.retry}</button>}
    {engine.state === 'conflict' && <button type="button" className="btn btn-secondary" onClick={() => { if (confirm(copy.discard)) reload() }}>{copy.reload}</button>}
  </div>
}
