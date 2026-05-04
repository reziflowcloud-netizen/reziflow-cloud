import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tables = [
    'Service', 'CaseStatus', 'TaskPriority', 'Employee', 'CaseOption',
    'CaseCustomDate', 'DocUpdate', 'CaseDocument', 'TravelHistory', 'User',
    'Client', 'Case', 'Task', 'Payment', 'Comment'
  ]
  const results: Record<string, string> = {}

  for (const table of tables) {
    try {
      // Use pg_sequences to find the sequence for this table
      const seqs = await prisma.$queryRawUnsafe<any[]>(`
        SELECT sequence_name 
        FROM information_schema.sequences 
        WHERE sequence_schema = 'public'
        AND sequence_name ILIKE '%${table.toLowerCase()}%id%'
        OR sequence_name ILIKE '%${table.toLowerCase()}%_seq%'
      `)
      
      if (seqs.length > 0) {
        const seqName = seqs[0].sequence_name
        const maxRow = await prisma.$queryRawUnsafe<any[]>(
          `SELECT COALESCE(MAX(id), 0) as max FROM "${table}"`
        )
        const maxVal = Number(maxRow[0].max)
        await prisma.$executeRawUnsafe(
          `SELECT setval('${seqName}', ${maxVal + 1}, false)`
        )
        results[table] = `✅ ok (seq: ${seqName}, next id: ${maxVal + 1})`
      } else {
        // Fallback: try pg_get_serial_sequence
        await prisma.$executeRawUnsafe(
          `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false)`
        )
        results[table] = '✅ ok (fallback)'
      }
    } catch (e: any) {
      results[table] = `❌ ${e.message?.slice(0, 100)}`
    }
  }

  return NextResponse.json({ ok: true, results })
}
