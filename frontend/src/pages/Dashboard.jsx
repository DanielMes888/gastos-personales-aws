import { calculateSummary, CATEGORY_COLORS, currency, currentMonth, expensesForMonth, formatDate, monthLabel } from '../lib/finance'

export function Dashboard({ user, expenses, budget, onNavigate }) {
  const month = currentMonth()
  const monthExpenses = expensesForMonth(expenses, month)
  const summary = calculateSummary(monthExpenses, budget)
  const categories = monthExpenses.reduce((totals, expense) => {
    totals[expense.category] = (totals[expense.category] || 0) + Number(expense.amount)
    return totals
  }, {})
  const firstName = user.name.split(' ')[0]

  return (
    <>
      <header className="page-header">
        <div><p className="eyebrow">{monthLabel(month).toUpperCase()}</p><h1>Hola, {firstName}</h1><p className="page-subtitle">Así se ven tus finanzas este mes.</p></div>
        <button className="primary" onClick={() => onNavigate('registrar')}>+ Registrar gasto</button>
      </header>
      <section className="hero-grid">
        <article className="balance-card">
          <span>Total gastado</span><strong>{currency.format(summary.total)}</strong>
          <div className="balance-meta"><span>{summary.count} {summary.count === 1 ? 'movimiento' : 'movimientos'}</span><span>{summary.percent.toFixed(1)}% del límite</span></div>
          <div className="progress"><span className={summary.status.key} style={{ width: `${Math.min(summary.percent, 100)}%` }} /></div>
        </article>
        <article className={`status-card ${summary.status.key}`}>
          <span className="status-symbol" aria-hidden="true">{summary.status.key === 'danger' ? '!' : summary.status.key === 'warning' ? '△' : '✓'}</span>
          <div><small>Estado del presupuesto</small><strong>{summary.status.label}</strong><p>{summary.status.detail}</p></div>
        </article>
      </section>
      <section className="stat-grid">
        <article><span>Presupuesto mensual</span><strong>{summary.limit ? currency.format(summary.limit) : 'Sin definir'}</strong><button className="inline-link" onClick={() => onNavigate('presupuesto')}>{summary.limit ? 'Editar límite' : 'Crear presupuesto'} →</button></article>
        <article><span>Porcentaje usado</span><strong>{summary.percent.toFixed(1)}%</strong><small>Alerta configurada al {summary.alert}%</small></article>
        <article><span>Cantidad de gastos</span><strong>{summary.count}</strong><small>Registrados en {monthLabel(month).toLowerCase()}</small></article>
        <article><span>Mayor categoría</span><strong>{summary.topCategory?.[0] || 'Sin datos'}</strong><small>{summary.topCategory ? currency.format(summary.topCategory[1]) : 'Registra tu primer gasto'}</small></article>
      </section>
      <div className="dashboard-columns">
        <section className="panel">
          <div className="section-title"><div><p className="eyebrow">ACTIVIDAD</p><h2>Gastos recientes</h2></div><button className="text-button" onClick={() => onNavigate('historial')}>Ver historial →</button></div>
          {monthExpenses.length ? <div className="expense-list">{monthExpenses.slice(0, 5).map((expense) => <div key={expense.id}><span className="category-dot" style={{ background: CATEGORY_COLORS[expense.category] }} /><span><strong>{expense.description}</strong><small>{expense.category} · {formatDate(expense.date)}</small></span><strong>{currency.format(expense.amount)}</strong></div>)}</div> : <div className="empty-state"><span>＋</span><h3>Aún no hay gastos</h3><p>Registra tu primer movimiento del mes.</p><button className="secondary" onClick={() => onNavigate('registrar')}>Agregar gasto</button></div>}
        </section>
        <section className="panel category-panel">
          <div><p className="eyebrow">DISTRIBUCIÓN</p><h2>Por categoría</h2></div>
          {Object.keys(categories).length ? <div className="category-list">{Object.entries(categories).sort((a, b) => b[1] - a[1]).map(([category, amount]) => <div key={category}><div><span><i style={{ background: CATEGORY_COLORS[category] }} />{category}</span><strong>{currency.format(amount)}</strong></div><div className="mini-bar"><i style={{ width: `${summary.total ? (amount / summary.total) * 100 : 0}%`, background: CATEGORY_COLORS[category] }} /></div></div>)}</div> : <div className="empty-state compact"><p>Las categorías aparecerán aquí.</p></div>}
        </section>
      </div>
    </>
  )
}
