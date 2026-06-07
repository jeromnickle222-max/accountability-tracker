export const HABITS = [
  { id: 'scripture', label: 'Scripture study', points: 3, category: 'spiritual' },
  { id: 'prayer', label: 'Prayer', points: 2, category: 'spiritual' },
  { id: 'journal', label: 'Journaling', points: 2, category: 'spiritual' },
  { id: 'workout', label: 'Workout', points: 4, category: 'physical' },
  { id: 'outreach', label: 'Sales outreach', points: 5, category: 'outreach' },
  { id: 'reading', label: 'Reading (30 min)', points: 3, category: 'highvalue' },
  { id: 'meditation', label: 'Meditation sessions', points: 2, category: 'counter', isCounter: true },
  { id: 'noporn', label: 'No porn', points: 0, category: 'penalty', isPenalty: true, penaltyAmount: 5 },
]

export const CATEGORY_COLORS = {
  spiritual: { bg: '#0d9488', light: '#ccfbf1', label: 'Spiritual' },
  physical: '#2563eb',
  outreach: '#2563eb',
  highvalue: '#7c3aed',
  counter: '#d97706',
  penalty: '#dc2626',
}

export const CATEGORY_STYLES = {
  spiritual: { color: '#0d9488', bg: 'rgba(13,148,136,0.1)', border: '#0d9488' },
  physical: { color: '#2563eb', bg: 'rgba(37,99,235,0.1)', border: '#2563eb' },
  outreach: { color: '#2563eb', bg: 'rgba(37,99,235,0.1)', border: '#2563eb' },
  highvalue: { color: '#7c3aed', bg: 'rgba(124,58,237,0.1)', border: '#7c3aed' },
  counter: { color: '#d97706', bg: 'rgba(217,119,6,0.1)', border: '#d97706' },
  penalty: { color: '#dc2626', bg: 'rgba(220,38,38,0.1)', border: '#dc2626' },
}

export const PARTNER_NAME = 'Gideon'
