import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import RefreshButton from './RefreshButton'
import Avatar from './Avatar'
import PetPage from './PetPage'
import PetHomeCard from './PetHomeCard'
import { CHORE_KINDS, CHORE_TIMES, outsideChoreTime } from '../lib/choreKinds'
import { uploadAvatar } from '../lib/avatar'

// Shown to a child on their own device. When `childId` is given, a signed-in parent
// is viewing the page on that child's behalf (and `onExit` returns to the dashboard).
export default function ChildView({ displayName, onLogout, childId, onExit }) {
  const actingAsParent = Boolean(childId)

  // Weekday/weekend chores (the database makes the final call, in the family timezone)
  const isWeekend = [0, 6].includes(new Date().getDay())
  const unavailableToday = (chore) =>
    (chore.available_days === 'weekdays' && isWeekend) ||
    (chore.available_days === 'weekends' && !isWeekend)
  const [user, setUser] = useState(null)
  const [chores, setChores] = useState([])
  const [rewards, setRewards] = useState([])
  const [balance, setBalance] = useState(0)
  const [completedToday, setCompletedToday] = useState(0)
  const [doneTodayIds, setDoneTodayIds] = useState(new Set())
  const [onceDoneIds, setOnceDoneIds] = useState(new Set()) // one-time chores completed by anyone
  const [myDoneIds, setMyDoneIds] = useState(new Set()) // chores this child has ever completed
  const [takenIds, setTakenIds] = useState(new Set()) // up-for-grabs chores another child already has
  const [pendingIds, setPendingIds] = useState(new Set()) // sent for parent confirmation
  const [deniedToday, setDeniedToday] = useState({}) // chore id -> parent's note (or '')
  const [bonuses, setBonuses] = useState([]) // bonus messages not yet dismissed
  const [avatarVersion, setAvatarVersion] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [section, setSection] = useState('chores') // 'chores' | 'pet'
  const [petReady, setPetReady] = useState(false) // false until the pets database setup exists
  const [petTokens, setPetTokens] = useState(0)

  useEffect(() => {
    if (childId) {
      setUser({ id: childId })
      loadAll(childId)
      return
    }
    // Get current user
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user)
      if (data?.user) loadAll(data.user.id)
    })
  }, [childId])

  const loadAll = async (userId) => {
    // Load balance
    const { data: bal } = await supabase.from('child_balances').select('balance').eq('child_id', userId).single()
    setBalance(bal?.balance || 0)

    // Load available chores
    const { data: choresData } = await supabase.from('chores').select('*').eq('is_active', true).or(`assigned_to.is.null,assigned_to.eq.${userId}`)
    setChores(choresData || [])

    // Load available rewards
    const { data: rewardsData } = await supabase.from('rewards').select('*').eq('is_available', true).order('token_cost', { ascending: true }).order('name', { ascending: true })
    setRewards(rewardsData || [])

    // Completed today (local midnight onward)
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const { data: todayTasks } = await supabase
      .from('completed_tasks')
      .select('chore_id')
      .eq('child_id', userId)
      .gte('completed_at', startOfToday.toISOString())
    setCompletedToday(todayTasks?.length || 0)
    setDoneTodayIds(new Set((todayTasks || []).map(t => t.chore_id)))

    // One-time chores: done by anyone (RPC) and done by me (all time)
    const { data: onceDone } = await supabase.rpc('completed_once_chore_ids')
    setOnceDoneIds(new Set(onceDone || []))
    const { data: mine } = await supabase.from('completed_tasks').select('chore_id').eq('child_id', userId)
    setMyDoneIds(new Set((mine || []).map(t => t.chore_id)))

    // Waiting for a parent, plus anything a parent turned down today
    const { data: subs } = await supabase
      .from('chore_submissions')
      .select('chore_id, status, note')
      .eq('child_id', userId)
      .or(`status.eq.pending,and(status.eq.denied,resolved_at.gte.${startOfToday.toISOString()})`)
    setPendingIds(new Set((subs || []).filter(x => x.status === 'pending').map(x => x.chore_id)))
    setDeniedToday(Object.fromEntries((subs || []).filter(x => x.status === 'denied').map(x => [x.chore_id, x.note || ''])))

    // Up-for-grabs chores another child has already sent in or finished today
    if (!actingAsParent) {
      const { data: taken } = await supabase.rpc('chore_taken_ids')
      setTakenIds(new Set(taken || []))
    }

    // Pets (parents can look at them too, read only)
    const { data: wallet, error: walletError } = await supabase
      .from('pet_wallets').select('tokens').eq('owner_id', userId).maybeSingle()
    setPetReady(!walletError)
    setPetTokens(wallet?.tokens || 0)

    // Bonus messages from a parent (only on the child's own device, not parent mode)
    if (!actingAsParent) {
      const { data: bonusData } = await supabase
        .from('bonus_awards')
        .select('id, amount, reason, awarded_by_name')
        .eq('child_id', userId)
        .is('seen_at', null)
        .order('created_at', { ascending: true })
      setBonuses(bonusData || [])
    }
  }

  const onPickAvatar = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow picking the same file again
    if (!file || !user) return
    setUploading(true)
    try {
      await uploadAvatar(user.id, file)
      setAvatarVersion(v => v + 1)
    } catch (err) {
      alert('Could not upload the picture: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const dismissBonus = async (bonus) => {
    setBonuses(list => list.filter(b => b.id !== bonus.id))
    await supabase.rpc('acknowledge_bonus', { p_bonus_id: bonus.id })
  }

  const bonusMessage = (b) => {
    const reason = (b.reason || '').trim()
    const tokens = `${b.amount} ${b.amount === 1 ? 'token' : 'tokens'}`
    if (!reason) return `${b.awarded_by_name} awarded you ${tokens}.`
    return `${b.awarded_by_name} awarded you ${tokens} for ${reason}${/[.!?]$/.test(reason) ? '' : '.'}`
  }

  // One-time chores: gone once done by anyone, or once done by me if every child has their own copy
  const onceDone = (chore) => (chore.assign_all ? myDoneIds : onceDoneIds).has(chore.id)

  const completeChore = async (chore) => {
    if (!user) return

    const { error } = actingAsParent
      ? await supabase.rpc('complete_chore_for_child', { p_child_id: childId, p_chore_id: chore.id })
      : await supabase.rpc('submit_chore', { p_chore_id: chore.id })
    if (error) {
      alert('Could not send chore: ' + error.message)
      return
    }

    await loadAll(user.id)
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Header with balance */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <label className="relative cursor-pointer" title="Change picture">
              <Avatar childId={user?.id} name={displayName} size={40} version={avatarVersion} />
              <span className="absolute -bottom-1 -right-1 bg-white rounded-full text-[10px] leading-none p-1 shadow">
                {uploading ? '⏳' : '📷'}
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={onPickAvatar} disabled={uploading} />
            </label>
            <span className="font-bold text-gray-800">{displayName}</span>
          </div>
          <div className="flex items-center gap-4">
            <RefreshButton />
            {actingAsParent ? (
              <button onClick={onExit} className="text-sm text-gray-500">← Back to dashboard</button>
            ) : (
              <button
                onClick={() => {
                  if (window.confirm('Sign out of this device? A parent will need to sign in again to set it up.')) onLogout()
                }}
                className="text-sm text-gray-500"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </nav>
      {actingAsParent && (
        <div className="bg-sun-100 text-sun-800 text-sm text-center py-2 px-4">
          Parent mode: completing chores for {displayName}
        </div>
      )}

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {petReady && (
          <div className="flex bg-white rounded-2xl border overflow-hidden">
            {[
              { key: 'chores', label: 'Chores', icon: '🧹' },
              { key: 'pet', label: 'My Pet', icon: '🐾' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setSection(t.key)}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                  section === t.key ? 'bg-sage-50 text-forest-800 border-b-2 border-sun-500' : 'text-gray-500'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        )}

        {bonuses.map(b => (
          <div key={b.id} className="bg-sun-100 border border-sun-500 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-2xl">🎉</span>
            <p className="flex-1 text-sun-800 font-medium">{bonusMessage(b)}</p>
            <button
              onClick={() => dismissBonus(b)}
              className="px-3 py-1 bg-sun-500 text-white rounded-full text-sm font-semibold shrink-0"
            >
              Thanks!
            </button>
          </div>
        ))}

        {section === 'pet' && petReady ? (
          <PetPage onTokensChange={setPetTokens} viewChildId={actingAsParent ? childId : null} viewName={displayName} />
        ) : (<>
        {/* Token balance card */}
        <div className="bg-forest-800 rounded-3xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-sage-300">Your Tokens</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="w-9 h-9 rounded-full bg-sun-500 flex items-center justify-center text-lg text-white">★</span>
                <p className="text-4xl font-bold text-sun-500 font-serif">{balance}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-sage-300">Done Today</p>
              <p className="text-3xl font-bold text-white font-serif mt-1">{completedToday}</p>
            </div>
          </div>
          {petReady && (
            <button
              onClick={() => setSection('pet')}
              className="mt-4 w-full flex items-center justify-between bg-forest-700 rounded-2xl px-4 py-2 text-sm text-sage-200"
            >
              <span>🐾 Pet Tokens: <span className="font-bold text-sun-500">{petTokens}</span></span>
              <span>Visit your pet →</span>
            </button>
          )}
        </div>

        {petReady && <PetHomeCard onOpen={() => setSection('pet')} childId={actingAsParent ? childId : null} />}

        {/* Available chores */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">🧹 Available Chores</h3>
          <div className="space-y-3">
            {chores.filter(chore => !(chore.frequency === 'once' && onceDone(chore)) && !takenIds.has(chore.id)).map(chore => (
              <div key={chore.id} className="bg-white p-4 rounded-xl shadow-sm border">
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-800">{chore.name}</h4>
                    {chore.kind && chore.kind !== 'chore' && CHORE_KINDS[chore.kind] && (
                      <span className={`text-xs px-2 py-1 rounded-full font-medium mt-1 mr-1 inline-block ${CHORE_KINDS[chore.kind].badge}`}>
                        {CHORE_KINDS[chore.kind].icon} {CHORE_KINDS[chore.kind].label}
                      </span>
                    )}
                    {chore.description && <p className="text-sm text-gray-500 mt-1">{chore.description}</p>}
                    <span className="text-xs px-2 py-1 bg-sun-100 text-sun-700 rounded-full mt-2 inline-block">+{chore.token_reward} tokens</span>
                    {deniedToday[chore.id] !== undefined && !pendingIds.has(chore.id) && (
                      <p className="text-xs text-red-600 mt-2">
                        Not approved this time{deniedToday[chore.id] ? `: ${deniedToday[chore.id]}` : ''}. You can try again.
                      </p>
                    )}
                  </div>
                  {outsideChoreTime(chore.available_time) && !actingAsParent ? (
                    <span className="ml-4 px-4 py-2 bg-gray-100 text-gray-400 rounded-xl text-sm font-medium text-center">
                      {CHORE_TIMES[chore.available_time].short}
                    </span>
                  ) : unavailableToday(chore) && !actingAsParent ? (
                    <span className="ml-4 px-4 py-2 bg-gray-100 text-gray-400 rounded-xl text-sm font-medium text-center">
                      {chore.available_days === 'weekdays' ? 'Weekdays only' : 'Weekends only'}
                    </span>
                  ) : pendingIds.has(chore.id) && !actingAsParent ? (
                    <span className="ml-4 px-4 py-2 bg-sun-100 text-sun-700 rounded-xl text-sm font-medium text-center">
                      Sent for confirmation ⏳
                    </span>
                  ) : (chore.frequency === 'daily' && doneTodayIds.has(chore.id)) ||
                   (chore.frequency === 'once' && onceDone(chore)) ? (
                    <span className="ml-4 px-4 py-2 bg-gray-100 text-gray-400 rounded-xl text-sm font-medium">
                      {chore.frequency === 'once' ? 'Completed ✓' : 'Done today ✓'}
                    </span>
                  ) : (
                    <div className="ml-4 flex flex-col items-end gap-1">
                      {pendingIds.has(chore.id) && (
                        <span className="text-xs text-sun-700">Sent for confirmation ⏳</span>
                      )}
                      <button
                        onClick={() => completeChore(chore)}
                        className="px-5 py-2 bg-sage-600 text-white rounded-full text-sm font-semibold tracking-wide hover:bg-sage-700 active:scale-95 transition-all"
                      >
                        Done ✓
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {chores.length === 0 && <p className="text-center text-gray-400 py-6">No chores available right now</p>}
          </div>
        </div>

        {/* Rewards catalog */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">🎁 Rewards Catalog</h3>
          <div className="space-y-3">
            {rewards.map(reward => (
              <div key={reward.id} className="bg-white p-4 rounded-xl shadow-sm border">
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-800">{reward.name}</h4>
                    {reward.description && <p className="text-sm text-gray-500 mt-1">{reward.description}</p>}
                    <span className="text-xs px-2 py-1 bg-tan-100 text-tan-700 rounded-full mt-2 inline-block">{reward.token_cost} tokens</span>
                  </div>
                  <div className={`ml-4 px-3 py-1 rounded-full text-xs font-medium ${
                    balance >= reward.token_cost 
                      ? 'bg-sage-100 text-sage-700' 
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {balance >= reward.token_cost ? 'Affordable' : `${reward.token_cost - balance} more needed`}
                  </div>
                </div>
              </div>
            ))}
            {rewards.length === 0 && <p className="text-center text-gray-400 py-6">No rewards available right now</p>}
          </div>
        </div>
        </>)}
      </main>
    </div>
  )
}
