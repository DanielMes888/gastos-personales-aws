export const CATEGORIES = [
  'Alimentación',
  'Transporte',
  'Vivienda',
  'Servicios',
  'Salud',
  'Entretenimiento',
  'Educación',
  'Otros',
]

export const CATEGORY_COLORS = {
  Alimentación: '#467a68',
  Transporte: '#d1953f',
  Vivienda: '#6f78a8',
  Servicios: '#63a6a0',
  Salud: '#c66f67',
  Entretenimiento: '#9c72a3',
  Educación: '#5f83b2',
  Otros: '#8c948f',
}

export const currency = new Intl.NumberFormat('es-PA', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})

export function currentMonth() {
  return localDate().slice(0, 7)
}

export function localDate() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export function monthLabel(month) {
  if (!month) return 'Todos los meses'
  const [year, monthNumber] = month.split('-').map(Number)
  const label = new Intl.DateTimeFormat('es-PA', { month: 'long', year: 'numeric' })
    .format(new Date(year, monthNumber - 1, 1))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function formatDate(date) {
  return new Intl.DateTimeFormat('es-PA', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(`${date}T12:00:00`))
}

export function expensesForMonth(expenses, month) {
  return expenses.filter((expense) => expense.date.startsWith(month))
}

export function calculateSummary(expenses, budget = {}) {
  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0)
  const limit = Number(budget.limit || 0)
  const alert = Number(budget.alert || 80)
  const percent = limit > 0 ? (total / limit) * 100 : 0
  const categories = expenses.reduce((totals, expense) => {
    totals[expense.category] = (totals[expense.category] || 0) + Number(expense.amount)
    return totals
  }, {})
  const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0]

  let status = { key: 'ok', label: 'Dentro del presupuesto', detail: 'Tus gastos están bajo control.' }
  if (!limit) status = { key: 'neutral', label: 'Sin presupuesto', detail: 'Define un límite para activar alertas.' }
  else if (percent > 100) status = { key: 'danger', label: 'Presupuesto superado', detail: `Excediste el límite por ${currency.format(total - limit)}.` }
  else if (percent >= alert) status = { key: 'warning', label: 'Cerca del límite', detail: `Te quedan ${currency.format(Math.max(limit - total, 0))}.` }

  return { total, limit, alert, percent, count: expenses.length, topCategory, status }
}
