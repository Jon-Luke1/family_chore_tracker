// A chore can be labelled as a plain chore, a goal or a challenge. It is only a label;
// every kind is completed and approved the same way. Keep in sync with chores_kind_check
// in supabase/chore-kinds.sql.
// Time-of-day chores. Hours are in the family timezone (America/New_York) and must match
// submit_chore in supabase/rls-policies.sql.
export const CHORE_TIMES = {
  any: { label: 'Any time' },
  morning: { label: 'Morning (6am–noon)', short: 'Morning only', from: 6, to: 12 },
  evening: { label: 'Afternoon/evening (noon–10pm)', short: 'Afternoon/evening only', from: 12, to: 22 },
}

export function outsideChoreTime(time) {
  const t = CHORE_TIMES[time]
  if (!t?.from) return false
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' }).format(new Date()))
  return hour < t.from || hour >= t.to
}

export const CHORE_KINDS = {
  chore: { label: 'Chore', icon: '🧹', badge: 'bg-sage-100 text-sage-700' },
  goal: { label: 'Goal', icon: '🎯', badge: 'bg-blue-100 text-blue-700' },
  challenge: { label: 'Challenge', icon: '🏆', badge: 'bg-purple-100 text-purple-700' },
}
