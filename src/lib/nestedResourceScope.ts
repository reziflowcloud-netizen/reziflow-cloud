export function caseChildWhere<T extends string | number>(caseId: string, childId: T) {
  return { id: childId, caseId }
}
