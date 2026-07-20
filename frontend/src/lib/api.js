const BASE_URL = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '')

export const apiConfigurada = Boolean(BASE_URL)

export class ApiError extends Error {
  constructor(message, status = 0, code = 'NETWORK_ERROR') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

function queryString(filters = {}) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, value)
  })
  const query = params.toString()
  return query ? `?${query}` : ''
}

async function request(path, options = {}) {
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok || payload?.ok === false) {
      throw new ApiError(
        payload?.error?.message || `La API respondió con estado ${response.status}.`,
        response.status,
        payload?.error?.code || 'API_ERROR',
      )
    }
    return payload?.data ?? payload
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError('No fue posible conectar con la API. Revisa VITE_API_URL y CORS.')
  }
}

function post(path, data) {
  return request(path, { method: 'POST', body: JSON.stringify(data) })
}

// Fallback efímero para trabajar sin VITE_API_URL. No escribe datos en localStorage.
const month = new Date().toISOString().slice(0, 7)
const localState = {
  expenses: [
    { usuarioId: 'demo-user', gastoId: 'demo-1', monto: 86.45, categoria: 'Alimentación', descripcion: 'Supermercado', fecha: `${month}-03` },
    { usuarioId: 'demo-user', gastoId: 'demo-2', monto: 42, categoria: 'Transporte', descripcion: 'Gasolina', fecha: `${month}-07` },
    { usuarioId: 'demo-user', gastoId: 'demo-3', monto: 64.9, categoria: 'Servicios', descripcion: 'Internet y móvil', fecha: `${month}-10` },
  ],
  budgets: [{ usuarioId: 'demo-user', mes: month, limiteMensual: 1200, porcentajeAlerta: 80 }],
}

function localExpenses(usuarioId, filtros = {}) {
  let items = localState.expenses.filter((expense) => expense.usuarioId === usuarioId)
  let mes = String(filtros.mes || '')
  let anio = String(filtros.anio || '')
  if (mes.length === 7) [anio, mes] = mes.split('-')
  if (anio) items = items.filter((expense) => expense.fecha.startsWith(`${anio}-`))
  if (mes) items = items.filter((expense) => expense.fecha.slice(5, 7) === mes.padStart(2, '0'))
  if (filtros.categoria) items = items.filter((expense) => expense.categoria === filtros.categoria)
  return items.sort((a, b) => b.fecha.localeCompare(a.fecha))
}

export async function crearUsuario(data) {
  if (apiConfigurada) return post('/usuarios', data)
  throw new ApiError('Configura VITE_API_URL para crear usuarios.', 0, 'API_NOT_CONFIGURED')
}

export async function login(data) {
  if (apiConfigurada) return post('/login', data)
  throw new ApiError('Configura VITE_API_URL para iniciar sesión.', 0, 'API_NOT_CONFIGURED')
}

export async function obtenerUsuario(usuarioId) {
  if (apiConfigurada) return request(`/usuarios/${encodeURIComponent(usuarioId)}`)
  throw new ApiError('Configura VITE_API_URL para consultar usuarios.', 0, 'API_NOT_CONFIGURED')
}

export async function crearGasto(data) {
  if (apiConfigurada) return post('/gastos', data)
  const expense = { ...data, gastoId: crypto.randomUUID(), creadoEn: new Date().toISOString() }
  localState.expenses.push(expense)
  return expense
}

export async function obtenerGastos(usuarioId, filtros = {}) {
  if (apiConfigurada) return request(`/gastos/${encodeURIComponent(usuarioId)}${queryString(filtros)}`)
  const gastos = localExpenses(usuarioId, filtros)
  return { gastos, cantidad: gastos.length, filtros }
}

export async function guardarPresupuesto(data) {
  if (apiConfigurada) return post('/presupuestos', data)
  const index = localState.budgets.findIndex((item) => item.usuarioId === data.usuarioId && item.mes === data.mes)
  const budget = { ...data, actualizadoEn: new Date().toISOString() }
  if (index >= 0) localState.budgets[index] = budget
  else localState.budgets.push(budget)
  return budget
}

export async function obtenerPresupuesto(usuarioId, filtros = {}) {
  if (apiConfigurada) return request(`/presupuestos/${encodeURIComponent(usuarioId)}${queryString(filtros)}`)
  const selectedMonth = filtros.mes || month
  const budget = localState.budgets.find((item) => item.usuarioId === usuarioId && item.mes === selectedMonth)
  if (!budget) throw new ApiError('No existe un presupuesto para el mes solicitado.', 404, 'BUDGET_NOT_FOUND')
  const expenses = localExpenses(usuarioId, { mes: selectedMonth })
  const totalGastado = expenses.reduce((sum, expense) => sum + Number(expense.monto), 0)
  const porcentajeUsado = (totalGastado / Number(budget.limiteMensual)) * 100
  const estado = porcentajeUsado > 100 ? 'PRESUPUESTO_SUPERADO' : porcentajeUsado >= Number(budget.porcentajeAlerta) ? 'CERCA_DEL_LIMITE' : 'DENTRO_DEL_PRESUPUESTO'
  return { ...budget, totalGastado, porcentajeUsado, estado, cantidadGastos: expenses.length, disponible: Math.max(Number(budget.limiteMensual) - totalGastado, 0) }
}

export async function generarReporte(usuarioId, filtros = {}) {
  if (apiConfigurada) return request(`/reportes/${encodeURIComponent(usuarioId)}${queryString(filtros)}`)
  const { gastos } = await obtenerGastos(usuarioId, filtros)
  return { local: true, gastos, cantidadRegistros: gastos.length }
}
