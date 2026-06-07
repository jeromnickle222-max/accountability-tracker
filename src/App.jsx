import { useState, useEffect, useCallback } from 'react'
import { db } from './firebase'
import { doc, getDoc, setDoc, collection, getDocs, query, orderBy, limit, deleteDoc } from 'firebase/firestore'
import { CATEGORY_STYLES, PARTNER_NAME } from './habits'
import './App.css'

const TODAY = new Date().toISOString().split('T')[0]

const DEFAULT_HABITS = [
  { id: 'scripture', label: 'Scripture study', points: 3, category: 'spiritual', type: 'checkbox' },
  { id: 'prayer', label: 'Prayer', points: 2, category: 'spiritual', type: 'checkbox' },
  { id: 'journal', label: 'Journaling', points: 2, category: 'spiritual', type: 'checkbox' },
  { id: 'workout', label: 'Workout', points: 4, category: 'physical', type: 'checkbox' },
  { id: 'outreach', label: 'Sales outreach', points: 5, category: 'outreach', type: 'checkbox' },
  { id: 'reading', label: 'Reading (30 min)', points: 3, category: 'highvalue', type: 'checkbox' },
  { id: 'meditation', label: 'Meditation sessions', points: 2, category: 'counter', type: 'counter' },
  { id: 'noporn', label: 'No porn', points: 0, category: 'penalty', type: 'penalty', penaltyAmount: 5 },
]

function getWeekDates() {
  const today = new Date()
  const day = today.getDay()
  const diff = today.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(today)
  monday.setDate(diff)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = firstDay.getDay()
  const days = []
  for (let i = 0; i < startDow; i++) days.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push(dateStr)
  }
  return days
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const CATEGORY_OPTIONS = ['spiritual', 'physical', 'outreach', 'highvalue', 'counter', 'penalty']

export default function App() {
  const [tab, setTab] = useState('today')
  const [habits, setHabits] = useState(DEFAULT_HABITS)
  const [dayData, setDayData] = useState({})
  const [weekData, setWeekData] = useState({})
  const [historyData, setHistoryData] = useState({})
  const [ledger, setLedger] = useState([])
  const [loading, setLoading] = useState(true)
  const weekDates = getWeekDates()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [todaySnap, habitsSnap, historySnap, ledgerSnap] = await Promise.all([
        getDoc(doc(db, 'days', TODAY)),
        getDoc(doc(db, 'settings', 'habits')),
        getDocs(query(collection(db, 'days'), orderBy('__name__', 'desc'), limit(120))),
        getDocs(query(collection(db, 'ledger'), orderBy('date', 'desc'), limit(50))),
      ])

      if (habitsSnap.exists()) setHabits(habitsSnap.data().list)
      if (todaySnap.exists()) setDayData(todaySnap.data())

      const history = {}
      historySnap.forEach(d => { history[d.id] = d.data() })
      setHistoryData(history)

      const weekPromises = weekDates.map(d => getDoc(doc(db, 'days', d)))
      const weekSnaps = await Promise.all(weekPromises)
      const week = {}
      weekSnaps.forEach((snap, i) => { if (snap.exists()) week[weekDates[i]] = snap.data() })
      setWeekData(week)

      const entries = []
      ledgerSnap.forEach(d => entries.push({ id: d.id, ...d.data() }))
      setLedger(entries)
    } catch (e) {
      console.error('Load error:', e)
    } finally {
      setLoading(false)
    }
  }

  async function saveHabits(newHabits) {
    setHabits(newHabits)
    await setDoc(doc(db, 'settings', 'habits'), { list: newHabits })
  }

  async function updateDay(date, newData) {
    await setDoc(doc(db, 'days', date), newData, { merge: true })
    setHistoryData(prev => ({ ...prev, [date]: { ...(prev[date] || {}), ...newData } }))
  }

  async function toggleHabit(habitId, date = TODAY) {
    const current = (date === TODAY ? dayData : weekData[date] || {})[habitId] || false
    const newVal = !current
    if (date === TODAY) {
      const newData = { ...dayData, [habitId]: newVal }
      setDayData(newData)
      setWeekData(prev => ({ ...prev, [TODAY]: newData }))
      await updateDay(date, { [habitId]: newVal })
    } else {
      const existing = weekData[date] || {}
      const newData = { ...existing, [habitId]: newVal }
      setWeekData(prev => ({ ...prev, [date]: newData }))
      await updateDay(date, { [habitId]: newVal })
    }
  }

  async function setCounter(habitId, val, date = TODAY) {
    const newVal = Math.max(0, val)
    if (date === TODAY) {
      const newData = { ...dayData, [habitId]: newVal }
      setDayData(newData)
      setWeekData(prev => ({ ...prev, [TODAY]: newData }))
    } else {
      const existing = weekData[date] || {}
      setWeekData(prev => ({ ...prev, [date]: { ...existing, [habitId]: newVal } }))
    }
    await updateDay(date, { [habitId]: newVal })
  }

  async function triggerPenalty(habitId, date = TODAY) {
    const habit = habits.find(h => h.id === habitId)
    const dataForDate = date === TODAY ? dayData : (weekData[date] || {})
    const current = dataForDate[habitId] || false
    const newVal = !current

    if (date === TODAY) {
      const newData = { ...dayData, [habitId]: newVal }
      setDayData(newData)
      setWeekData(prev => ({ ...prev, [TODAY]: newData }))
    } else {
      const existing = weekData[date] || {}
      setWeekData(prev => ({ ...prev, [date]: { ...existing, [habitId]: newVal } }))
    }
    await updateDay(date, { [habitId]: newVal })

    if (newVal) {
      const entry = { date, type: 'penalty', habit: habit.label, amount: -(habit.penaltyAmount || 5), note: 'Penalty triggered' }
      const entryRef = doc(collection(db, 'ledger'))
      await setDoc(entryRef, entry)
      setLedger(prev => [{ id: entryRef.id, ...entry }, ...prev])
    }
  }

  function calcPoints(data, habitList = habits) {
    let pts = 0
    habitList.forEach(h => {
      if (h.type === 'counter') pts += (data[h.id] || 0) * (h.points || 0)
      else if (h.type === 'checkbox' && data[h.id]) pts += (h.points || 0)
    })
    return pts
  }

  function calcMax(habitList = habits) {
    return habitList.filter(h => h.type === 'checkbox').reduce((s, h) => s + (h.points || 0), 0)
  }

  const todayPoints = calcPoints(dayData)
  const maxPoints = calcMax()
  const ledgerBalance = ledger.reduce((sum, e) => sum + (e.amount || 0), 0)

  if (loading) return (
    <div className="loading">
      <div className="spinner" />
      <p>Loading...</p>
    </div>
  )

  return (
    <div className="app">
      <header className="header">
        <h1>Accountability</h1>
        <div className="balance-pill" style={{ color: ledgerBalance >= 0 ? '#0d9488' : '#dc2626' }}>
          ${Math.abs(ledgerBalance).toFixed(2)} {ledgerBalance >= 0 ? 'ahead' : `owed to ${PARTNER_NAME}`}
        </div>
      </header>
      <nav className="tabs">
        {['today', 'weekly', 'history', 'ledger', 'settings'].map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>
      <main className="main">
        {tab === 'today' && <TodayTab habits={habits} dayData={dayData} todayPoints={todayPoints} maxPoints={maxPoints} onToggle={toggleHabit} onCounter={setCounter} onPenalty={triggerPenalty} />}
        {tab === 'weekly' && <WeeklyTab habits={habits} weekData={weekData} weekDates={weekDates} calcPoints={calcPoints} onToggle={toggleHabit} onCounter={setCounter} onPenalty={triggerPenalty} />}
        {tab === 'history' && <HistoryTab historyData={historyData} calcPoints={calcPoints} maxPoints={maxPoints} />}
        {tab === 'ledger' && <LedgerTab ledger={ledger} balance={ledgerBalance} setLedger={setLedger} />}
        {tab === 'settings' && <SettingsTab habits={habits} onSave={saveHabits} />}
      </main>
    </div>
  )
}

function HabitRow({ habit, value, onToggle, onCounter, onPenalty, compact = false }) {
  const style = CATEGORY_STYLES[habit.category] || CATEGORY_STYLES['spiritual']
  const pts = habit.points || 0

  if (habit.type === 'counter') {
    const count = value || 0
    return (
      <div className={`habit-row counter-row ${compact ? 'compact' : ''}`} style={{ borderLeftColor: style.border }}>
        <div className="habit-info">
          <span className="habit-label">{habit.label}</span>
          {!compact && <span className="habit-pts" style={{ color: style.color }}>+{pts} pts each</span>}
        </div>
        <div className="counter-controls">
          <button className="counter-btn" onClick={() => onCounter(habit.id, count - 1)}>−</button>
          <span className="counter-val">{count}</span>
          <button className="counter-btn" onClick={() => onCounter(habit.id, count + 1)}>+</button>
        </div>
      </div>
    )
  }

  if (habit.type === 'penalty') {
    const triggered = value || false
    return (
      <div className={`habit-row penalty-row ${triggered ? 'penalty-active' : ''} ${compact ? 'compact' : ''}`} style={{ borderLeftColor: style.border }}>
        <div className="habit-info">
          <span className="habit-label">{habit.label}</span>
          {!compact && <span className="habit-pts" style={{ color: style.color }}>−${habit.penaltyAmount || 5}</span>}
        </div>
        <button className={`penalty-btn ${triggered ? 'triggered' : ''}`} onClick={() => onPenalty(habit.id)}>
          {triggered ? '✓' : compact ? '!' : 'Log slip'}
        </button>
      </div>
    )
  }

  const checked = value || false
  return (
    <div className={`habit-row ${checked ? 'checked' : ''} ${compact ? 'compact' : ''}`} style={{ borderLeftColor: style.border }} onClick={() => onToggle(habit.id)}>
      <div className="habit-info">
        <span className="habit-label">{habit.label}</span>
        {!compact && <span className="habit-pts" style={{ color: style.color }}>+{pts} pts</span>}
      </div>
      <div className="checkbox" style={{ borderColor: style.border, background: checked ? style.color : 'transparent' }}>
        {checked && <span>✓</span>}
      </div>
    </div>
  )
}

function TodayTab({ habits, dayData, todayPoints, maxPoints, onToggle, onCounter, onPenalty }) {
  const pct = maxPoints > 0 ? Math.min(100, (todayPoints / maxPoints) * 100) : 0
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  return (
    <div className="today">
      <div className="score-card">
        <div className="score-date">{date}</div>
        <div className="score-num">{todayPoints} <span>pts</span></div>
        <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
        <div className="score-sub">{Math.round(pct)}% of daily max ({maxPoints} pts)</div>
      </div>
      <div className="habits-list">
        {habits.map(habit => (
          <HabitRow key={habit.id} habit={habit} value={dayData[habit.id]} onToggle={id => onToggle(id)} onCounter={(id, v) => onCounter(id, v)} onPenalty={id => onPenalty(id)} />
        ))}
      </div>
    </div>
  )
}

function WeeklyTab({ habits, weekData, weekDates, calcPoints, onToggle, onCounter, onPenalty }) {
  const [selectedDay, setSelectedDay] = useState(TODAY)
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="weekly-v2">
      <div className="week-day-picker">
        {weekDates.map(date => {
          const d = new Date(date + 'T12:00:00')
          const pts = calcPoints(weekData[date] || {})
          const isToday = date === TODAY
          const isSelected = date === selectedDay
          return (
            <button key={date} className={`week-day-btn ${isSelected ? 'selected' : ''} ${isToday ? 'is-today' : ''}`} onClick={() => setSelectedDay(date)}>
              <span className="wdb-label">{dayLabels[d.getDay()]}</span>
              <span className="wdb-num">{d.getDate()}</span>
              <span className="wdb-pts">{pts}p</span>
            </button>
          )
        })}
      </div>
      <div className="week-habits-for-day">
        <div className="week-day-title">
          {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          {selectedDay === TODAY && <span className="today-badge">Today</span>}
        </div>
        {habits.map(habit => (
          <HabitRow
            key={habit.id}
            habit={habit}
            value={(weekData[selectedDay] || {})[habit.id]}
            onToggle={id => onToggle(id, selectedDay)}
            onCounter={(id, v) => onCounter(id, v, selectedDay)}
            onPenalty={id => onPenalty(id, selectedDay)}
          />
        ))}
      </div>
    </div>
  )
}

function HistoryTab({ historyData, calcPoints, maxPoints }) {
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const fullMonthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const grid = getMonthGrid(viewYear, viewMonth)
  const dayOfWeekLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  return (
    <div className="history-v2">
      <div className="month-nav">
        <button className="month-nav-btn" onClick={prevMonth}>‹</button>
        <span className="month-title">{fullMonthNames[viewMonth]} {viewYear}</span>
        <button className="month-nav-btn" onClick={nextMonth}>›</button>
      </div>
      <div className="cal-dow-row">
        {dayOfWeekLabels.map(d => <div key={d} className="cal-dow">{d}</div>)}
      </div>
      <div className="cal-grid">
        {grid.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} className="cal-cell empty" />
          const pts = calcPoints(historyData[date] || {})
          const hasData = !!historyData[date]
          const pct = maxPoints > 0 ? pts / maxPoints : 0
          const opacity = hasData ? Math.max(0.15, Math.min(1, pct)) : 0
          const isToday = date === TODAY
          const isFuture = date > TODAY
          const dayNum = parseInt(date.split('-')[2])
          return (
            <div
              key={date}
              className={`cal-cell ${isToday ? 'cal-today' : ''} ${isFuture ? 'cal-future' : ''}`}
              style={{ background: !isFuture && hasData ? `rgba(13,148,136,${opacity})` : undefined }}
              title={hasData ? `${date}: ${pts} pts` : date}
            >
              <span className="cal-day-num">{dayNum}</span>
              {hasData && !isFuture && <span className="cal-pts">{pts}</span>}
            </div>
          )
        })}
      </div>
      <div className="month-summary">
        <div className="month-stat">
          <span className="month-stat-label">Days logged</span>
          <span className="month-stat-val">{grid.filter(d => d && historyData[d] && d <= TODAY).length}</span>
        </div>
        <div className="month-stat">
          <span className="month-stat-label">Total pts</span>
          <span className="month-stat-val">{grid.filter(d => d && d <= TODAY).reduce((s, d) => s + calcPoints(historyData[d] || {}), 0)}</span>
        </div>
        <div className="month-stat">
          <span className="month-stat-label">Best day</span>
          <span className="month-stat-val">{Math.max(0, ...grid.filter(d => d && d <= TODAY).map(d => calcPoints(historyData[d] || {})))} pts</span>
        </div>
      </div>
    </div>
  )
}

function LedgerTab({ ledger, balance, setLedger }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [type, setType] = useState('payment')

  async function addEntry() {
    if (!amount) return
    const val = parseFloat(amount)
    const entry = { date: TODAY, type, amount: type === 'payment' ? Math.abs(val) : -Math.abs(val), note: note || (type === 'payment' ? 'Payment made' : 'Manual penalty') }
    const entryRef = doc(collection(db, 'ledger'))
    await setDoc(entryRef, entry)
    setLedger(prev => [{ id: entryRef.id, ...entry }, ...prev])
    setAmount(''); setNote('')
  }

  return (
    <div className="ledger">
      <div className={`balance-card ${balance >= 0 ? 'positive' : 'negative'}`}>
        <div className="balance-label">Balance with {PARTNER_NAME}</div>
        <div className="balance-amount">${Math.abs(balance).toFixed(2)}</div>
        <div className="balance-status">{balance >= 0 ? 'You are ahead' : `You owe ${PARTNER_NAME}`}</div>
      </div>
      <div className="ledger-form">
        <select value={type} onChange={e => setType(e.target.value)} className="ledger-select">
          <option value="payment">Payment made</option>
          <option value="penalty">Manual penalty</option>
        </select>
        <input type="number" placeholder="Amount ($)" value={amount} onChange={e => setAmount(e.target.value)} className="ledger-input" />
        <input type="text" placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} className="ledger-input" />
        <button onClick={addEntry} className="ledger-btn">Add Entry</button>
      </div>
      <div className="ledger-entries">
        {ledger.map(entry => (
          <div key={entry.id} className="ledger-row">
            <div className="ledger-row-left">
              <span className="ledger-entry-date">{entry.date}</span>
              <span className="ledger-entry-note">{entry.note}</span>
            </div>
            <span className={`ledger-entry-amount ${entry.amount >= 0 ? 'pos' : 'neg'}`}>
              {entry.amount >= 0 ? '+' : ''}${Math.abs(entry.amount).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SettingsTab({ habits, onSave }) {
  const [list, setList] = useState(habits.map(h => ({ ...h })))
  const [saved, setSaved] = useState(false)

  function updateHabit(id, field, value) {
    setList(prev => prev.map(h => h.id === id ? { ...h, [field]: value } : h))
  }

  function addHabit() {
    const newId = `habit_${Date.now()}`
    setList(prev => [...prev, { id: newId, label: 'New habit', points: 2, category: 'spiritual', type: 'checkbox', penaltyAmount: 5 }])
  }

  function removeHabit(id) {
    setList(prev => prev.filter(h => h.id !== id))
  }

  function handleSave() {
    onSave(list)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="settings">
      <div className="settings-header">
        <h2 className="section-title">Habits</h2>
        <button className="add-habit-btn" onClick={addHabit}>+ Add habit</button>
      </div>
      <div className="settings-list">
        {list.map(habit => {
          const style = CATEGORY_STYLES[habit.category] || CATEGORY_STYLES['spiritual']
          return (
            <div key={habit.id} className="settings-card" style={{ borderLeftColor: style.border }}>
              <div className="settings-card-row">
                <input
                  type="text"
                  value={habit.label}
                  onChange={e => updateHabit(habit.id, 'label', e.target.value)}
                  className="settings-name-input"
                  placeholder="Habit name"
                />
                <button className="delete-btn" onClick={() => removeHabit(habit.id)}>✕</button>
              </div>
              <div className="settings-card-row">
                <label className="settings-mini-label">Type</label>
                <select value={habit.type} onChange={e => updateHabit(habit.id, 'type', e.target.value)} className="settings-select">
                  <option value="checkbox">Checkbox</option>
                  <option value="counter">Counter</option>
                  <option value="penalty">Penalty</option>
                </select>
                <label className="settings-mini-label">{habit.type === 'penalty' ? 'Fine $' : 'Points'}</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={habit.type === 'penalty' ? (habit.penaltyAmount || 5) : (habit.points || 0)}
                  onChange={e => updateHabit(habit.id, habit.type === 'penalty' ? 'penaltyAmount' : 'points', parseInt(e.target.value) || 0)}
                  className="settings-pts-input"
                />
              </div>
              <div className="settings-card-row">
                <label className="settings-mini-label">Category</label>
                <select value={habit.category} onChange={e => updateHabit(habit.id, 'category', e.target.value)} className="settings-select">
                  {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          )
        })}
      </div>
      <button onClick={handleSave} className="save-btn">{saved ? 'Saved ✓' : 'Save all changes'}</button>
    </div>
  )
}
