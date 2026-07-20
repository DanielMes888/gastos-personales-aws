import { useCallback, useEffect, useMemo, useState } from 'react'
import { Login } from './pages/Login'
import { CrearCuenta } from './pages/CrearCuenta'
import { Dashboard } from './pages/Dashboard'
import { RegistrarGasto } from './pages/RegistrarGasto'
import { HistorialGastos } from './pages/HistorialGastos'
import { PresupuestoMensual } from './pages/PresupuestoMensual'
import { Reportes } from './pages/Reportes'
import {
  apiConfigurada,
  crearGasto,
  crearUsuario,
  generarReporte,
  guardarPresupuesto,
  login,
  obtenerGastos,
  obtenerPresupuesto,
  obtenerUsuario,
} from './lib/api'
import { clearSession, getSession, saveSession } from './lib/storage'
import { currentMonth } from './lib/finance'

const views = { dashboard: Dashboard, registrar: RegistrarGasto, historial: HistorialGastos, presupuesto: PresupuestoMensual, reportes: Reportes }
const navigation = [
  ['dashboard', '⌂', 'Resumen'],
  ['registrar', '+', 'Registrar gasto'],
  ['historial', '≡', 'Historial'],
  ['presupuesto', '◎', 'Presupuesto'],
  ['reportes', '↗', 'Reportes'],
]

function normalizeUser(user) {
  return { id: user.usuarioId, name: user.nombre, email: user.email || user.correo }
}

function sessionFromUser(user) {
  return { usuarioId: user.id, nombre: user.name, correo: user.email }
}

function normalizeExpense(expense) {
  return {
    id: expense.gastoId,
    amount: Number(expense.monto),
    category: expense.categoria,
    description: expense.descripcion,
    date: expense.fecha,
  }
}

function normalizeBudget(budget) {
  if (!budget) return null
  return { limit: Number(budget.limiteMensual), alert: Number(budget.porcentajeAlerta), raw: budget }
}

export default function App() {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const [view, setView] = useState('dashboard')
  const [expenses, setExpenses] = useState([])
  const [budgets, setBudgets] = useState({})
  const [appError, setAppError] = useState('')

  const loadBudget = useCallback(async (usuarioId, month) => {
    try {
      const data = await obtenerPresupuesto(usuarioId, { mes: month, anio: month.slice(0, 4) })
      const normalized = normalizeBudget(data)
      setBudgets((current) => ({ ...current, [month]: normalized }))
      return normalized
    } catch (error) {
      if (error.code === 'BUDGET_NOT_FOUND') {
        setBudgets((current) => ({ ...current, [month]: { limit: 0, alert: 80 } }))
        return null
      }
      throw error
    }
  }, [])

  const loadUserData = useCallback(async (activeUser) => {
    const month = currentMonth()
    const [expenseData] = await Promise.all([
      obtenerGastos(activeUser.id, {}),
      loadBudget(activeUser.id, month),
    ])
    setExpenses((expenseData.gastos || []).map(normalizeExpense))
  }, [loadBudget])

  useEffect(() => {
    let active = true
    async function restoreSession() {
      const stored = getSession()
      if (!stored) {
        if (active) setReady(true)
        return
      }
      try {
        const profile = apiConfigurada
          ? normalizeUser(await obtenerUsuario(stored.usuarioId))
          : { id: stored.usuarioId, name: stored.nombre, email: stored.correo }
        if (!active) return
        await loadUserData(profile)
        if (active) setUser(profile)
      } catch (error) {
        clearSession()
        if (active) {
          setUser(null)
          setAppError(error.message)
        }
      } finally {
        if (active) setReady(true)
      }
    }
    restoreSession()
    return () => { active = false }
  }, [loadUserData])

  const currentBudget = useMemo(() => budgets[currentMonth()] || { limit: 0, alert: 80 }, [budgets])

  async function startSession(apiUser) {
    const profile = normalizeUser(apiUser)
    await loadUserData(profile)
    saveSession(sessionFromUser(profile))
    setUser(profile)
    setAppError('')
    setView('dashboard')
  }

  async function handleLogin(credentials) {
    const result = await login({ correo: credentials.email, contraseña: credentials.password })
    await startSession(result.usuario)
  }

  async function handleCreateAccount(account) {
    await crearUsuario({ nombre: account.name, correo: account.email, contraseña: account.password })
    const result = await login({ correo: account.email, contraseña: account.password })
    await startSession(result.usuario)
  }

  function handleLogout() {
    clearSession()
    setUser(null)
    setExpenses([])
    setBudgets({})
    setView('login')
  }

  async function addExpense(expense) {
    const created = await crearGasto({
      usuarioId: user.id,
      monto: expense.amount,
      categoria: expense.category,
      descripcion: expense.description,
      fecha: expense.date,
    })
    setExpenses((current) => [normalizeExpense(created), ...current])
    setView('dashboard')
  }

  const queryExpenses = useCallback(async (filters) => {
    if (!user) return []
    const data = await obtenerGastos(user.id, filters)
    return (data.gastos || []).map(normalizeExpense)
  }, [user])

  const queryBudget = useCallback(async (month) => {
    if (!user) return null
    return loadBudget(user.id, month)
  }, [loadBudget, user])

  async function updateBudget(month, budget) {
    const saved = await guardarPresupuesto({
      usuarioId: user.id,
      mes: month,
      limiteMensual: budget.limit,
      porcentajeAlerta: budget.alert,
    })
    const normalized = normalizeBudget(saved)
    setBudgets((current) => ({ ...current, [month]: normalized }))
    return normalized
  }

  async function createReport(filters) {
    return generarReporte(user.id, filters)
  }

  if (!ready) return <div className="loading-screen">Conectando con tus finanzas…</div>

  if (!user) {
    if (view === 'cuenta') return <CrearCuenta onCreate={handleCreateAccount} onNavigate={setView} apiConfigured={apiConfigurada} />
    return <Login onLogin={handleLogin} onNavigate={setView} apiConfigured={apiConfigurada} initialError={appError} />
  }

  const Screen = views[view] || Dashboard
  const screenProps = {
    user,
    expenses,
    budgets,
    budget: currentBudget,
    apiConfigured: apiConfigurada,
    onNavigate: setView,
    onAddExpense: addExpense,
    onQueryExpenses: queryExpenses,
    onLoadBudget: queryBudget,
    onUpdateBudget: updateBudget,
    onGenerateReport: createReport,
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setView('dashboard')}>
          <span className="brand-mark">M</span><span>Mis Gastos<small>Finanzas personales</small></span>
        </button>
        <nav aria-label="Navegación principal">
          {navigation.map(([key, icon, label]) => (
            <button className={view === key ? 'active' : ''} key={key} onClick={() => setView(key)}>
              <span aria-hidden="true">{icon}</span>{label}
            </button>
          ))}
        </nav>
        <div className="sidebar-profile">
          <span className="avatar">{user.name.charAt(0).toUpperCase()}</span>
          <span><strong>{user.name}</strong><small>{user.email}</small></span>
        </div>
        <button className="logout" onClick={handleLogout}>↪ Cerrar sesión</button>
      </aside>
      <main className="content">
        {!apiConfigurada && <p className="connection-banner">Modo local de desarrollo · configura VITE_API_URL para usar AWS</p>}
        <Screen {...screenProps} />
      </main>
    </div>
  )
}
