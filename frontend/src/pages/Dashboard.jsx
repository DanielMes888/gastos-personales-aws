import { calculateSummary, CATEGORY_COLORS, currency, currentMonth, expensesForMonth, formatDate, monthLabel } from '../lib/finance'

function shortDateLabel(date) {
  const formatted = new Intl.DateTimeFormat('es-PA', { day: 'numeric', month: 'short' })
    .format(new Date(`${date}T12:00:00`))
    .replace('.', '')
  const [day, monthName] = formatted.split(' ')
  return `${day} ${monthName.charAt(0).toUpperCase()}${monthName.slice(1)}`
}

function chartScaleMaximum(maximum) {
  if (maximum <= 0) return 100
  const rawStep = maximum / 3
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const normalized = rawStep / magnitude
  const niceStep = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10
  return niceStep * magnitude * 3
}

function usdLabel(value, decimals = 0) {
  return `USD ${new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value)}`
}

function chartXPosition(index, totalPoints) {
  if (totalPoints <= 1) return 50
  return 7 + (index / (totalPoints - 1)) * 86
}

export function Dashboard({ user, expenses, budget, onNavigate }) {
  const month = currentMonth()
  const monthExpenses = expensesForMonth(expenses, month)
  const summary = calculateSummary(monthExpenses, budget)
  const hasBudget = summary.limit > 0
  const available = summary.limit - summary.total
  const visibleBudgetPercent = Math.min(Math.max(summary.percent, 0), 100)
  const firstName = user.name.split(' ')[0]

  const categoryTotals = Object.entries(monthExpenses.reduce((totals, expense) => {
    totals[expense.category] = (totals[expense.category] || 0) + Number(expense.amount)
    return totals
  }, {})).sort((a, b) => b[1] - a[1])
  const largestCategoryTotal = categoryTotals[0]?.[1] || 0

  const dailyTotals = monthExpenses.reduce((totals, expense) => {
    totals[expense.date] = (totals[expense.date] || 0) + Number(expense.amount)
    return totals
  }, {})
  let accumulated = 0
  const cumulativeExpenses = Object.entries(dailyTotals)
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, amount]) => {
      accumulated += amount
      return { date, day: Number(date.slice(-2)), total: accumulated }
    })
  const chartMaximum = chartScaleMaximum(cumulativeExpenses.at(-1)?.total || 0)
  const chartTicks = [chartMaximum, chartMaximum / 2, 0]
  const plottedExpenses = cumulativeExpenses.map((expense, index, items) => {
    const x = chartXPosition(index, items.length)
    const y = 34 - (expense.total / chartMaximum) * 27
    return { ...expense, x, y }
  })
  const chartDateLabels = plottedExpenses.length <= 4
    ? plottedExpenses
    : [plottedExpenses[0], plottedExpenses[Math.floor((plottedExpenses.length - 1) / 2)], plottedExpenses.at(-1)]
  const linePoints = plottedExpenses.map(({ x, y }) => {
    return `${x.toFixed(2)},${y.toFixed(2)}`
  }).join(' ')
  const areaPoints = plottedExpenses.length > 1 ? `${plottedExpenses[0].x},36 ${linePoints} ${plottedExpenses.at(-1).x},36` : ''
  const lastChartPoint = plottedExpenses.at(-1)
  const donutColor = summary.status.key === 'danger' ? '#d45b66' : summary.status.key === 'warning' ? '#e0a13a' : '#159ca7'

  return (
    <>
      <header className="page-header dashboard-hero">
        <div><p className="eyebrow">{monthLabel(month).toUpperCase()}</p><h1>Hola, {firstName}</h1><p className="page-subtitle">Este es el resumen de tus finanzas del mes.</p></div>
        <button className="primary" onClick={() => onNavigate('registrar')}>+ Registrar gasto</button>
      </header>

      <section className="stat-grid dashboard-stats" aria-label="Indicadores principales del mes">
        <article className="summary-card"><span>Gasto total del mes</span><strong>{currency.format(summary.total)}</strong><small>{summary.count} {summary.count === 1 ? 'movimiento registrado' : 'movimientos registrados'}</small></article>
        <article className="summary-card"><span>Presupuesto mensual</span><strong>{hasBudget ? currency.format(summary.limit) : 'Sin definir'}</strong><button className="inline-link" onClick={() => onNavigate('presupuesto')}>{hasBudget ? 'Editar presupuesto' : 'Crear presupuesto'} →</button></article>
        <article className={`summary-card ${available < 0 ? 'stat-danger' : ''}`}><span>{available < 0 ? 'Presupuesto superado por' : 'Disponible'}</span><strong>{hasBudget ? currency.format(Math.abs(available)) : 'Sin definir'}</strong><small>{hasBudget ? (available < 0 ? 'Revisa tus gastos del mes' : 'Saldo restante del mes') : 'Configura un presupuesto'}</small></article>
        <article className="summary-card"><span>Mayor categoría</span><strong>{summary.topCategory?.[0] || 'Sin datos'}</strong><small>{summary.topCategory ? currency.format(summary.topCategory[1]) : 'Registra tu primer gasto'}</small></article>
      </section>

      <section className="panel financial-overview" aria-labelledby="financial-overview-title">
        <div className="financial-overview-heading"><div><p className="eyebrow">PANEL FINANCIERO</p><h2 id="financial-overview-title">Resumen general</h2></div><span>{monthLabel(month)}</span></div>
        <div className="financial-overview-content">
          <div className="financial-overview-metrics">
            <article className="financial-mini-card"><span>Gasto mensual</span><strong>{currency.format(summary.total)}</strong><small>Acumulado actual</small></article>
            <article className="financial-mini-card"><span>Presupuesto</span><strong>{hasBudget ? currency.format(summary.limit) : 'Sin definir'}</strong><small>Límite del mes</small></article>
            <article className={`financial-mini-card ${available < 0 ? 'negative' : ''}`}><span>{available < 0 ? 'Exceso' : 'Saldo disponible'}</span><strong>{hasBudget ? currency.format(Math.abs(available)) : 'Sin definir'}</strong><small>{available < 0 ? 'Sobre el presupuesto' : 'Para el resto del mes'}</small></article>
          </div>

          <div className="financial-overview-charts">
            <article className="donut-card">
              <div className="budget-donut" style={{ '--donut-angle': `${visibleBudgetPercent * 3.6}deg`, '--donut-color': donutColor }} role="img" aria-label={hasBudget ? `${summary.percent.toFixed(1)} por ciento del presupuesto usado` : 'Sin presupuesto configurado'}>
                <div className="budget-donut-center"><strong>{hasBudget ? `${summary.percent.toFixed(1)}%` : '0%'}</strong><span>{hasBudget ? 'usado' : 'sin definir'}</span></div>
              </div>
              <div><strong>Presupuesto usado</strong><small>{hasBudget ? summary.status.label : 'Sin presupuesto'}</small></div>
            </article>

            <article className="line-chart-card">
              <div className="line-chart-heading"><div><strong>Evolución de gastos</strong><small>Acumulado durante el mes</small></div><strong>{currency.format(summary.total)}</strong></div>
              {plottedExpenses.length ? (
                <div className="expense-line-chart">
                  <div className="chart-y-axis" aria-hidden="true">{chartTicks.map((tick) => <span className="chart-axis-label" key={tick}>{usdLabel(tick)}</span>)}</div>
                  <div className="chart-plot">
                    <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="Evolución acumulada de gastos del mes">
                      {chartTicks.map((tick) => {
                        const y = 34 - (tick / chartMaximum) * 27
                        return <line key={tick} x1="4" y1={y} x2="96" y2={y} className="chart-grid-line" />
                      })}
                      {plottedExpenses.length > 1 && <polygon points={areaPoints} className="chart-area" />}
                      {plottedExpenses.length > 1 && <polyline points={linePoints} className="chart-line" />}
                      {plottedExpenses.map(({ date, total, x, y }) => {
                        return <circle key={date} cx={x} cy={y} r={plottedExpenses.length === 1 ? 2 : 1.4} className="chart-point"><title>{`${shortDateLabel(date)} · ${usdLabel(total, 2)} acumulado`}</title></circle>
                      })}
                    </svg>
                    {lastChartPoint && <span className="chart-value-label" style={{ left: `${lastChartPoint.x}%`, top: `${Math.max(16, (lastChartPoint.y / 40) * 100)}%` }}>{usdLabel(lastChartPoint.total, 2)}</span>}
                  </div>
                  <span aria-hidden="true" />
                  <div className="chart-x-axis" aria-hidden="true">{chartDateLabels.map(({ date, x }) => <span className="chart-date-label" key={date} style={{ left: `${x}%` }}>{shortDateLabel(date)}</span>)}</div>
                </div>
              ) : <div className="line-chart-empty">Registra gastos para ver la evolución mensual.</div>}
            </article>
          </div>
        </div>
      </section>

      <section className="panel category-chart-panel">
        <div><p className="eyebrow">DISTRIBUCIÓN DEL MES</p><h2>Gastos por categoría</h2></div>
        {categoryTotals.length ? (
          <div className="category-chart">
            {categoryTotals.map(([category, amount]) => {
              const percentage = summary.total ? (amount / summary.total) * 100 : 0
              return (
                <div className="category-chart-row" key={category}>
                  <div className="category-chart-label"><span>{category}</span><span><small>{percentage.toFixed(1)}%</small><strong className="category-chart-value">{currency.format(amount)}</strong></span></div>
                  <div className="category-chart-track" aria-hidden="true">
                    <span className="category-chart-fill" style={{ width: `${(amount / largestCategoryTotal) * 100}%`, '--bar-color': CATEGORY_COLORS[category] || '#159ca7' }} />
                  </div>
                </div>
              )
            })}
          </div>
        ) : <div className="chart-empty-state"><p>Aún no hay gastos registrados para generar gráficos.</p></div>}
      </section>

      <section className="panel recent-expenses">
        <div className="section-title"><div><p className="eyebrow">ACTIVIDAD</p><h2>Gastos recientes</h2></div><button className="text-button" onClick={() => onNavigate('historial')}>Ver historial →</button></div>
        {monthExpenses.length ? <div className="expense-list">{monthExpenses.slice(0, 5).map((expense) => <div key={expense.id}><span className="category-dot" style={{ background: CATEGORY_COLORS[expense.category] }} /><span><strong>{expense.description}</strong><small>{expense.category} · {formatDate(expense.date)}</small></span><strong>{currency.format(expense.amount)}</strong></div>)}</div> : <div className="empty-state"><span>＋</span><h3>Aún no hay gastos</h3><p>Registra tu primer movimiento del mes.</p><button className="secondary" onClick={() => onNavigate('registrar')}>Agregar gasto</button></div>}
      </section>
    </>
  )
}
