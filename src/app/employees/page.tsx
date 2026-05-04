// src/app/employees/page.tsx
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function EmployeesPage() {
  const user = await getUser()
  const organizationId = getOrganizationId(user)
  const employees = await prisma.user.findMany({ where: { organizationId }, orderBy: { createdAt: 'asc' } })

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Сотрудники</div>
          <div className="page-subtitle">Всего: {employees.length}</div>
        </div>
      </div>
      <div className="page-body">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Email</th>
                <th>Роль</th>
                <th>Добавлен</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar">{emp.name[0]}</div>
                      {emp.name}
                    </div>
                  </td>
                  <td>{emp.email}</td>
                  <td>
                    <span className="badge" style={{ background: emp.role === 'admin' ? '#fef3c7' : '#eff6ff', color: emp.role === 'admin' ? '#92400e' : '#1d4ed8' }}>
                      {emp.role === 'admin' ? 'Администратор' : 'Сотрудник'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--muted)', fontSize: 13 }}>{new Date(emp.createdAt).toLocaleDateString('ru')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card" style={{ marginTop: 16, fontSize: 13, color: 'var(--muted)' }}>
          💡 Чтобы добавить сотрудника — обратитесь к администратору или используйте переменную среды <code>ADMIN_EMAIL</code> при настройке.
        </div>
      </div>
    </div>
  )
}
