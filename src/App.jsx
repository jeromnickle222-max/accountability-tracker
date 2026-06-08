import { useState, useEffect } from 'react'
import { db } from './firebase'
import { doc, getDoc, setDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore'
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

const CATEGORY_OPTIONS = ['spiritual', 'physical', 'outreach', 'highvalue', 'counter', 'penalty']

function getWeekStart(offsetWeeks = 0) {
  const today = new Date()
  const day = today.getDay()
  const diff = today.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(today)
  monday.setDate(diff + offsetWeeks * 7)
  return monday
}

function getWeekDates(offsetWeeks = 0) {
  const monday = getWeekStart(offsetWeeks)
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
    days.push(`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`)
  }
  return days
}

export default function App() {
  const [tab, setTab] = useState('today')
  const [habits, setHabits] = useState(DEFAULT_HABITS)
  const [dayData, setDayData] = useState({})
  const [weekData, setWeekData] = useState({})
  const [historyData, setHistoryData] = useState({})
  const [ledger, setLedger] = useState([])
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)

  const weekDates = getWeekDates(weekOffset)

  useEffect(() => { loadData() }, [])
  useEffect(() => { loadWeek() }, [weekOffset])

  async function loadData() {
    try {
      const [todaySnap, habitsSnap, historySnap, ledgerSnap] = await Promise.all([
        getDoc(doc(db, 'days', TODAY)),
        getDoc(doc(db, 'settings', 'habits')),
        getDocs(query(collection(db, 'days'), orderBy('__name__', 'desc'), limit(120))),
        getDocs(query(collection(db, 'ledger'), orderBy('date', 'desc'), limit(100))),
      ])
      if (habitsSnap.exists()) setHabits(habitsSnap.data().list)
      if (todaySnap.exists()) setDayData(todaySnap.data())
      const history = {}
      historySnap.forEach(d => { history[d.id] = d.data() })
      setHistoryData(history)
      const entries = []
      ledgerSnap.forEach(d => entries.push({ id: d.id, ...d.data() }))
      setLedger(entries)
      await loadWeekDates(getWeekDates(0))
    } catch (e) {
      console.error('Load error:', e)
    } finally {
      setLoading(false)
    }
  }

  async function loadWeek() {
    const dates = getWeekDates(weekOffset)
    await loadWeekDates(dates)
  }

  async function loadWeekDates(dates) {
    const snaps = await Promise.all(dates.map(d => getDoc(doc(db, 'days', d))))
    const week = {}
    snaps.forEach((snap, i) => { if (snap.exists()) week[dates[i]] = snap.data() })
    setWeekData(prev => ({ ...prev, ...week }))
  }

  async function saveHabits(newHabits) {
    setHabits(newHabits)
    await setDoc(doc(db, 'settings', 'habits'), { list: newHabits })
  }

  async function updateDay(date, patch) {
    await setDoc(doc(db, 'days', date), patch, { merge: true })
    setHistoryData(prev => ({ ...prev, [date]: { ...(prev[date] || {}), ...patch } }))
    setWeekData(prev => ({ ...prev, [date]: { ...(prev[date] || {}), ...patch } }))
    if (date === TODAY) setDayData(prev => ({ ...prev, ...patch }))
  }

  async function toggleHabit(habitId, date = TODAY) {
    const data = date === TODAY ? dayData : (weekData[date] || {})
    const newVal = !data[habitId]
    await updateDay(date, { [habitId]: newVal })
  }

  async function setCounter(habitId, val, date = TODAY) {
    await updateDay(date, { [habitId]: Math.max(0, val) })
  }

  async function setPenaltyCounter(habitId, val, date = TODAY) {
    await updateDay(date, { [habitId]: Math.max(0, val) })
  }

  function calcEarned(data, habitList = habits) {
    let total = 0
    habitList.forEach(h => {
      if (h.type === 'counter') total += (data[h.id] || 0) * (h.points || 0)
      else if (h.type === 'checkbox' && data[h.id]) total += (h.points || 0)
    })
    return total
  }

  function calcPenalties(data, habitList = habits) {
    let total = 0
    habitList.forEach(h => {
      if (h.type === 'penalty') total += (data[h.id] || 0) * (h.penaltyAmount || 5)
    })
    return total
  }

  function calcWeekEarned() {
    return getWeekDates(0).reduce((s, d) => s + calcEarned(weekData[d] || {}), 0)
  }

  function calcWeekPenalties() {
    return getWeekDates(0).reduce((s, d) => s + calcPenalties(weekData[d] || {}), 0)
  }

  const ledgerBalance = ledger.reduce((sum, e) => sum + (e.amount || 0), 0)
  const weekEarned = calcWeekEarned()
  const weekPenalties = calcWeekPenalties()

  if (loading) return (
    <div className="loading"><div className="spinner" /><p>Loading...</p></div>
  )

  return (
    <div className="app">
      <header className="header">
        <h1>Accountability</h1>
        <div className="balance-pill" style={{ color: ledgerBalance >= 0 ? '#0d9488' : '#dc2626' }}>
          ${Math.abs(ledgerBalance).toFixed(2)} {ledgerBalance >= 0 ? 'ahead' : `owed`}
        </div>
      </header>
      <nav className="tabs">
        {['today','weekly','history','ledger','settings'].map(t => (
          <button key={t} className={`tab ${tab===t?'active':''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </nav>
      <main className="main">
        {tab === 'today' && <TodayTab habits={habits} dayData={dayData} ledgerBalance={ledgerBalance} weekEarned={weekEarned} weekPenalties={weekPenalties} onToggle={toggleHabit} onCounter={setCounter} onPenalty={setPenaltyCounter} />}
        {tab === 'weekly' && <WeeklyTab habits={habits} weekData={weekData} weekDates={weekDates} weekOffset={weekOffset} setWeekOffset={setWeekOffset} calcEarned={calcEarned} calcPenalties={calcPenalties} onToggle={toggleHabit} onCounter={setCounter} onPenalty={setPenaltyCounter} />}
        {tab === 'history' && <HistoryTab habits={habits} historyData={historyData} />}
        {tab === 'ledger' && <LedgerTab ledger={ledger} balance={ledgerBalance} setLedger={setLedger} weekEarned={weekEarned} weekPenalties={weekPenalties} />}
        {tab === 'settings' && <SettingsTab habits={habits} onSave={saveHabits} />}
      </main>
    </div>
  )
}

function HabitRow({ habit, value, onToggle, onCounter, onPenalty }) {
  const style = CATEGORY_STYLES[habit.category] || CATEGORY_STYLES['spiritual']

  if (habit.type === 'counter') {
    const count = value || 0
    return (
      <div className="habit-row counter-row" style={{ borderLeftColor: style.border }}>
        <div className="habit-info">
          <span className="habit-label">{habit.label}</span>
          <span className="habit-pts" style={{ color: style.color }}>+${habit.points} each</span>
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
    const count = value || 0
    const total = count * (habit.penaltyAmount || 5)
    return (
      <div className={`habit-row penalty-row ${count > 0 ? 'penalty-active' : ''}`} style={{ borderLeftColor: style.border }}>
        <div className="habit-info">
          <span className="habit-label">{habit.label}</span>
          <span className="habit-pts" style={{ color: style.color }}>
            −${habit.penaltyAmount || 5} each {count > 0 ? `· $${total} total` : ''}
          </span>
        </div>
        <div className="counter-controls">
          <button className="counter-btn red" onClick={() => onPenalty(habit.id, count - 1)}>−</button>
          <span className="counter-val" style={{ color: count > 0 ? '#dc2626' : 'inherit' }}>{count}</span>
          <button className="counter-btn red" onClick={() => onPenalty(habit.id, count + 1)}>+</button>
        </div>
      </div>
    )
  }

  const checked = value || false
  return (
    <div className={`habit-row ${checked ? 'checked' : ''}`} style={{ borderLeftColor: style.border }} onClick={() => onToggle(habit.id)}>
      <div className="habit-info">
        <span className="habit-label">{habit.label}</span>
        <span className="habit-pts" style={{ color: style.color }}>+${habit.points}</span>
      </div>
      <div className="checkbox" style={{ borderColor: style.border, background: checked ? style.color : 'transparent' }}>
        {checked && <span>✓</span>}
      </div>
    </div>
  )
}

function TodayTab({ habits, dayData, ledgerBalance, weekEarned, weekPenalties, onToggle, onCounter, onPenalty }) {
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const net = weekEarned - weekPenalties

  return (
    <div className="today">
      <div className="score-card">
        <div className="score-date">{date}</div>
        <div className="balance-main" style={{ color: ledgerBalance >= 0 ? '#0d9488' : '#dc2626' }}>
          ${Math.abs(ledgerBalance).toFixed(2)}
          <span>{ledgerBalance >= 0 ? ' ahead' : ` owed to ${PARTNER_NAME}`}</span>
        </div>
        <div className="week-summary-row">
          <div className="week-summary-pill earned">
            <span className="wsp-label">This week earned</span>
            <span className="wsp-val">+${weekEarned.toFixed(2)}</span>
          </div>
          <div className="week-summary-pill penalty">
            <span className="wsp-label">This week penalties</span>
            <span className="wsp-val">−${weekPenalties.toFixed(2)}</span>
          </div>
        </div>
        <div className="week-net" style={{ color: net >= 0 ? '#0d9488' : '#dc2626' }}>
          Net this week: {net >= 0 ? '+' : ''}${net.toFixed(2)}
        </div>
      </div>
      <div className="habits-list">
        {habits.map(habit => (
          <HabitRow key={habit.id} habit={habit} value={dayData[habit.id]}
            onToggle={id => onToggle(id)} onCounter={(id,v) => onCounter(id,v)} onPenalty={(id,v) => onPenalty(id,v)} />
        ))}
      </div>
    </div>
  )
}

function WeeklyTab({ habits, weekData, weekDates, weekOffset, setWeekOffset, calcEarned, calcPenalties, onToggle, onCounter, onPenalty }) {
  const [selectedDay, setSelectedDay] = useState(TODAY)
  const dayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  const monday = new Date(weekDates[0] + 'T12:00:00')
  const sunday = new Date(weekDates[6] + 'T12:00:00')
  const weekLabel = `${monday.toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${sunday.toLocaleDateString('en-US',{month:'short',day:'numeric'})}`

  return (
    <div className="weekly-v2">
      <div className="week-nav">
        <button className="week-nav-btn" onClick={() => setWeekOffset(o => o - 1)}>‹</button>
        <span className="week-nav-label">{weekOffset === 0 ? 'This week' : weekLabel}</span>
        <button className="week-nav-btn" onClick={() => setWeekOffset(o => o + 1)} disabled={weekOffset >= 0}>›</button>
      </div>
      <div className="week-totals-row">
        <div className="week-total-pill earned">
          <span>Earned</span>
          <strong>+${weekDates.reduce((s,d) => s + calcEarned(weekData[d]||{}), 0).toFixed(2)}</strong>
        </div>
        <div className="week-total-pill penalty">
          <span>Penalties</span>
          <strong>−${weekDates.reduce((s,d) => s + calcPenalties(weekData[d]||{}), 0).toFixed(2)}</strong>
        </div>
      </div>
      <div className="week-day-picker">
        {weekDates.map(date => {
          const d = new Date(date + 'T12:00:00')
          const earned = calcEarned(weekData[date] || {})
          const penalties = calcPenalties(weekData[date] || {})
          const isToday = date === TODAY
          const isSelected = date === selectedDay
          const isFuture = date > TODAY
          return (
            <button key={date} className={`week-day-btn ${isSelected?'selected':''} ${isToday?'is-today':''} ${isFuture?'future':''}`} onClick={() => setSelectedDay(date)}>
              <span className="wdb-label">{dayLabels[d.getDay()]}</span>
              <span className="wdb-num">{d.getDate()}</span>
              {earned > 0 && <span className="wdb-earned">+${earned}</span>}
              {penalties > 0 && <span className="wdb-penalty">-${penalties}</span>}
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
          <HabitRow key={habit.id} habit={habit} value={(weekData[selectedDay]||{})[habit.id]}
            onToggle={id => onToggle(id, selectedDay)} onCounter={(id,v) => onCounter(id,v,selectedDay)} onPenalty={(id,v) => onPenalty(id,v,selectedDay)} />
        ))}
      </div>
    </div>
  )
}

function HistoryTab({ habits, historyData }) {
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [selectedHabits, setSelectedHabits] = useState([])

  const fullMonthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const dayLabels = ['Su','Mo','Tu','We','Th','Fr','Sa']

  function prevMonth() { if (viewMonth===0){setViewYear(y=>y-1);setViewMonth(11)}else setViewMonth(m=>m-1) }
  function nextMonth() { if (viewMonth===11){setViewYear(y=>y+1);setViewMonth(0)}else setViewMonth(m=>m+1) }

  function toggleHabitFilter(id) {
    setSelectedHabits(prev => prev.includes(id) ? prev.filter(h=>h!==id) : [...prev, id])
  }

  const grid = getMonthGrid(viewYear, viewMonth)

  function getDayStatus(date) {
    if (!date || date > TODAY) return null
    const data = historyData[date]
    if (!data) return 'empty'
    if (selectedHabits.length === 0) return 'any'
    return selectedHabits.every(id => {
      const h = habits.find(h => h.id === id)
      if (!h) return false
      if (h.type === 'penalty') return (data[id] || 0) > 0
      if (h.type === 'counter') return (data[id] || 0) > 0
      return !!data[id]
    }) ? 'all' : selectedHabits.some(id => !!data[id] || (data[id]||0)>0) ? 'some' : 'none'
  }

  return (
    <div className="history-v2">
      <div className="history-filter-label">Filter by habit:</div>
      <div className="history-filter-pills">
        {habits.map(h => {
          const style = CATEGORY_STYLES[h.category] || CATEGORY_STYLES['spiritual']
          const active = selectedHabits.includes(h.id)
          return (
            <button key={h.id} className={`filter-pill ${active?'active':''}`}
              style={{ borderColor: active ? style.border : 'transparent', color: active ? style.color : 'inherit' }}
              onClick={() => toggleHabitFilter(h.id)}>
              {h.label}
            </button>
          )
        })}
      </div>

      <div className="month-nav">
        <button className="month-nav-btn" onClick={prevMonth}>‹</button>
        <span className="month-title">{fullMonthNames[viewMonth]} {viewYear}</span>
        <button className="month-nav-btn" onClick={nextMonth}>›</button>
      </div>
      <div className="cal-dow-row">
        {dayLabels.map(d => <div key={d} className="cal-dow">{d}</div>)}
      </div>
      <div className="cal-grid">
        {grid.map((date, i) => {
          if (!date) return <div key={`e${i}`} className="cal-cell empty" />
          const status = getDayStatus(date)
          const isFuture = date > TODAY
          const isToday = date === TODAY
          const dayNum = parseInt(date.split('-')[2])
          let bg = 'var(--bg2)'
          if (status === 'all') bg = 'rgba(13,148,136,0.8)'
          else if (status === 'some') bg = 'rgba(13,148,136,0.35)'
          else if (status === 'any' && selectedHabits.length === 0 && historyData[date]) bg = 'rgba(13,148,136,0.4)'
          return (
            <div key={date} className={`cal-cell ${isToday?'cal-today':''} ${isFuture?'cal-future':''}`} style={{ background: bg }}>
              <span className="cal-day-num">{dayNum}</span>
              {status === 'all' && selectedHabits.length > 0 && <span className="cal-check">✓</span>}
            </div>
          )
        })}
      </div>
      <div className="cal-legend">
        <span className="legend-item"><span className="legend-dot" style={{background:'rgba(13,148,136,0.8)'}} />All selected</span>
        <span className="legend-item"><span className="legend-dot" style={{background:'rgba(13,148,136,0.35)'}} />Some</span>
        <span className="legend-item"><span className="legend-dot" style={{background:'var(--bg2)'}} />None</span>
      </div>
    </div>
  )
}

function LedgerTab({ ledger, balance, setLedger, weekEarned, weekPenalties }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [type, setType] = useState('payment')
  const net = weekEarned - weekPenalties

  async function addEntry() {
    if (!amount) return
    const val = parseFloat(amount)
    const entry = { date: TODAY, type, amount: type==='payment' ? Math.abs(val) : -Math.abs(val), note: note||(type==='payment'?'Payment made':'Manual penalty') }
    const entryRef = doc(collection(db, 'ledger'))
    await setDoc(entryRef, entry)
    setLedger(prev => [{ id: entryRef.id, ...entry }, ...prev])
    setAmount(''); setNote('')
  }

  return (
    <div className="ledger">
      <div className={`balance-card ${balance >= 0 ? 'positive' : 'negative'}`}>
        <div className="balance-label">Ledger balance with {PARTNER_NAME}</div>
        <div className="balance-amount">${Math.abs(balance).toFixed(2)}</div>
        <div className="balance-status">{balance >= 0 ? 'You are ahead' : `You owe ${PARTNER_NAME}`}</div>
      </div>

      <div className="week-reference-card">
        <div className="wrc-title">This week (not yet logged)</div>
        <div className="wrc-row">
          <span className="wrc-label">Earned</span>
          <span className="wrc-val earned">+${weekEarned.toFixed(2)}</span>
        </div>
        <div className="wrc-row">
          <span className="wrc-label">Penalties</span>
          <span className="wrc-val penalty">−${weekPenalties.toFixed(2)}</span>
        </div>
        <div className="wrc-divider" />
        <div className="wrc-row">
          <span className="wrc-label">Net to log</span>
          <span className="wrc-val" style={{ color: net >= 0 ? '#0d9488' : '#dc2626', fontWeight: 800 }}>
            {net >= 0 ? '+' : ''}${net.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="ledger-form">
        <select value={type} onChange={e => setType(e.target.value)} className="ledger-select">
          <option value="payment">Log earned (+)</option>
          <option value="penalty">Log penalty (−)</option>
        </select>
        <input type="number" placeholder="Amount ($)" value={amount} onChange={e => setAmount(e.target.value)} className="ledger-input" />
        <input type="text" placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} className="ledger-input" />
        <button onClick={addEntry} className="ledger-btn">Add to Ledger</button>
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

  useEffect(() => {
    setList(habits.map(h => ({ ...h })))
  }, [habits])

  function updateHabit(id, field, value) {
    setList(prev => prev.map(h => h.id === id ? { ...h, [field]: value } : h))
  }

  function addHabit() {
    const newId = `habit_${Date.now()}`
    setList(prev => [...prev, { id: newId, label: 'New habit', points: 2, category: 'spiritual', type: 'checkbox', penaltyAmount: 5 }])
  }

  function removeHabit(id) { setList(prev => prev.filter(h => h.id !== id)) }

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
                <input type="text" value={habit.label} onChange={e => updateHabit(habit.id,'label',e.target.value)} className="settings-name-input" placeholder="Habit name" />
                <button className="delete-btn" onClick={() => removeHabit(habit.id)}>✕</button>
              </div>
              <div className="settings-card-row">
                <label className="settings-mini-label">Type</label>
                <select value={habit.type} onChange={e => updateHabit(habit.id,'type',e.target.value)} className="settings-select">
                  <option value="checkbox">Checkbox</option>
                  <option value="counter">Counter</option>
                  <option value="penalty">Penalty</option>
                </select>
                <label className="settings-mini-label">{habit.type==='penalty' ? 'Fine $' : 'Earns $'}</label>
                <input type="number" min="0" max="100"
                  value={habit.type==='penalty' ? (habit.penaltyAmount||5) : (habit.points||0)}
                  onChange={e => updateHabit(habit.id, habit.type==='penalty'?'penaltyAmount':'points', parseInt(e.target.value)||0)}
                  className="settings-pts-input" />
              </div>
              <div className="settings-card-row">
                <label className="settings-mini-label">Category</label>
                <select value={habit.category} onChange={e => updateHabit(habit.id,'category',e.target.value)} className="settings-select">
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
