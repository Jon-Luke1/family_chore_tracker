// A chore can be labelled as a plain chore, a goal or a challenge. It is only a label;
// every kind is completed and approved the same way. Keep in sync with chores_kind_check
// in supabase/chore-kinds.sql.
export const CHORE_KINDS = {
  chore: { label: 'Chore', icon: '🧹', badge: 'bg-sage-100 text-sage-700' },
  goal: { label: 'Goal', icon: '🎯', badge: 'bg-blue-100 text-blue-700' },
  challenge: { label: 'Challenge', icon: '🏆', badge: 'bg-purple-100 text-purple-700' },
}
