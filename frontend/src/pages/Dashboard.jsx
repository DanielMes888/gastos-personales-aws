import { calculateSummary, CATEGORY_COLORS, currency, currentMonth, expensesForMonth, formatDate, monthLabel } from '../lib/finance'

export function Dashboard({ user, expenses, budget, onNavigate }) {
  const month = currentMonth()
  const monthExpenses = expensesForMonth(expenses, month)
  const summary = calculateSummary(monthExpenses, budget)
  const categories = monthExpenses.reduce((totals, expense) => {
    totals[expense.category] = (totals[expense.category] || 0) + Number(expense.amount)
    return totals
  }, {})
  const categoryTotals = Object.entries(categories).sort((a, b) => b[1] - a[1])
  const largestCategoryTotal = categoryTotals[0]?.[1] || 0
  const hasBudget = summary.limit > 0
  const available = summary.limit - summary.total
  const visibleBudgetPercent = Math.min(Math.max(summary.percent, 0), 100)
  const firstName = user.name.split(' ')[0]

  return (
    <>
      <header className="page-header">
        <div><p className="eyebrow">{monthLabel(month).toUpperCase()}</p><h1>Hola, {firstName}</h1><p className="page-subtitle">Así se ven tus finanzas este mes.</p></div>
        <button className="primary" onClick={() => onNavigate('registrar')}>+ Registrar gasto</button>
      </header>
      <section className="hero-grid">
        <article className="balance-card">
          <span>Progreso del presupuesto mensual</span><strong>{summary.percent.toFixed(1)}%</strong>
          <div className="progress"><span className={summary.status.key} style={{ width: `${Math.min(summary.percent, 100)}%` }} /></div>
          <div className="budget-breakdown">
            <span><small>Gastado</small><b>{currency.format(summary.total)}</b></span>
            <span><small>Presupuesto</small><b>{summary.limit ? currency.format(summary.limit) : 'Sin definir'}</b></span>
            <span><small>{summary.percent > 100 ? 'Excedido' : 'Disponible'}</small><b>{currency.format(summary.percent > 100 ? summary.total - summary.limit : Math.max(summary.limit - summary.total, 0))}</b></span>
          </div>
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
      <section className="dashboard-visualizations" aria-label="Gráficos del mes actual">
        <article className="panel budget-progress-section">
          <div><p className="eyebrow">PRESUPUESTO MENSUAL</p><h2>Uso del presupuesto</h2></div>
          {!hasBudget ? (
            <div className="chart-empty-state"><p>No tienes presupuesto configurado para este mes.</p><button className="secondary" onClick={() => onNavigate('presupuesto')}>Configurar presupuesto</button></div>
          ) : (
            <>
              <div className="budget-progress-summary">
                <span><small>Total gastado</small><strong>{currency.format(summary.total)}</strong></span>
                <span><small>Presupuesto mensual</small><strong>{currency.format(summary.limit)}</strong></span>
                <span className={available < 0 ? 'negative' : ''}><small>{available < 0 ? 'Presupuesto superado por' : 'Disponible'}</small><strong>{currency.format(Math.abs(available))}</strong></span>
                <span><small>Porcentaje usado</small><strong>{summary.percent.toFixed(1)}%</strong></span>
              </div>
              <div className="budget-progress-bar" role="progressbar" aria-label="Porcentaje usado del presupuesto" aria-valuemin="0" aria-valuemax="100" aria-valuenow={visibleBudgetPercent}>
                <span className={`budget-progress-fill ${summary.status.key}`} style={{ width: `${visibleBudgetPercent}%` }} />
              </div>
            </>
          )}
        </article>

        <article className="panel category-chart-panel">
          <div><p className="eyebrow">DISTRIBUCIÓN DEL MES</p><h2>Gastos por categoría</h2></div>
          {categoryTotals.length ? (
            <div className="category-chart">
              {categoryTotals.map(([category, amount]) => (
                <div className="category-chart-row" key={category}>
                  <div className="category-chart-label"><span>{category}</span><strong className="category-chart-value">{currency.format(amount)}</strong></div>
                  <div className="category-chart-track" aria-hidden="true">
                    <span className="category-chart-fill" style={{ width: `${(amount / largestCategoryTotal) * 100}%`, '--bar-color': CATEGORY_COLORS[category] || '#37d7f2' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="chart-empty-state"><p>Aún no hay gastos registrados para generar gráficos.</p></div>}
        </article>
      </section>

      <div className="dashboard-columns recent-only">
        <section className="panel">
          <div className="section-title"><div><p className="eyebrow">ACTIVIDAD</p><h2>Gastos recientes</h2></div><button className="text-button" onClick={() => onNavigate('historial')}>Ver historial →</button></div>
          {monthExpenses.length ? <div className="expense-list">{monthExpenses.slice(0, 5).map((expense) => <div key={expense.id}><span className="category-dot" style={{ background: CATEGORY_COLORS[expense.category] }} /><span><strong>{expense.description}</strong><small>{expense.category} · {formatDate(expense.date)}</small></span><strong>{currency.format(expense.amount)}</strong></div>)}</div> : <div className="empty-state"><span>＋</span><h3>Aún no hay gastos</h3><p>Registra tu primer movimiento del mes.</p><button className="secondary" onClick={() => onNavigate('registrar')}>Agregar gasto</button></div>}
        </section>
      </div>
    </>
  )
}
