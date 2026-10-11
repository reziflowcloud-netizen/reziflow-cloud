import { documentNameKey } from './documentChecklistPolicy.ts'

type LegacyRequirement = { id: number; value: string; order: number }

// A projection only: never rewrites CaseOption or the names-only MOS history.
export function projectLegacyRequirements(rows: LegacyRequirement[]) {
  const names = new Map<string, LegacyRequirement>()
  let normalizedDuplicates = 0, conflicts = 0, blankNames = 0
  for (const row of [...rows].sort((a, b) => a.order - b.order || a.id - b.id)) {
    const key = documentNameKey(row.value)
    if (!key) { blankNames++; continue }
    const previous = names.get(key)
    if (previous) {
      normalizedDuplicates++
      if (previous.value.trim() !== row.value.trim()) conflicts++
    } else names.set(key, row)
  }
  return {
    items: Array.from(names).map(([nameKey, row]) => ({ id: '', name: row.value.trim(), nameKey,
      required: true, forMos: true, active: true, sortOrder: row.order })),
    normalizedDuplicates, conflicts, blankNames,
  }
}

export function legacyOrphanDisposition(evidence: {
  serviceMissing: boolean; cases: number; matchingTasks: number; history: number;
  files: number; exactGeneralCounterpart: boolean;
}) {
  return evidence.serviceMissing && evidence.cases === 0 && evidence.matchingTasks === 0 &&
    evidence.history === 0 && evidence.files === 0 && evidence.exactGeneralCounterpart
    ? 'IGNORED_LEGACY_ORPHAN' : 'MANUAL_REVIEW_REQUIRED'
}
