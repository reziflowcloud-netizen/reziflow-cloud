import { Prisma } from '@prisma/client'

// Narrow SQL predicate shared by candidate and notification visibility queries.
// alias is an internal constant, never request input. Ordinary Tasks cannot qualify.
export function actualizationFallbackSql(alias: 't' | 'e') {
  const t = Prisma.raw(alias)
  return Prisma.sql`(${t}.id LIKE 'case-actualization-%' AND ${t}."assignedToId" IS NULL
    AND lower(trim(${t}.status)) NOT IN ('inactive','done','completed','cancelled','canceled')
    AND EXISTS (SELECT 1 FROM "Case" fallback_case
      WHERE fallback_case."organizationId" = ${t}."organizationId"
      AND fallback_case.id = (CASE WHEN pg_input_is_valid(${t}.description,'jsonb') THEN ${t}.description::jsonb ELSE '{}'::jsonb END)->'documentActualization'->>'caseId'
      AND fallback_case."decisionReceived" = false
      AND NOT EXISTS (SELECT 1 FROM "Employee" fallback_employee JOIN "User" fallback_user
        ON fallback_user.id = fallback_employee."userId" AND fallback_user."organizationId" = fallback_employee."organizationId"
        WHERE fallback_employee.id = fallback_case."employeeId" AND fallback_employee."organizationId" = fallback_case."organizationId"
        AND fallback_employee.active = true AND fallback_user.id = fallback_case."assignedToId")))`
}

export function actualizationAdmin(user: any) {
  return !!user && ['owner', 'admin'].includes(user.role) && user.restrictedAccess !== true
}
