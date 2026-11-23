import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ChildView({ displayName, onLogout }) {
  const [user, setUser] = useState(null)
  const [chores, setChores] = useState([])
  const [rewards, setRewards] = useState([])
  const [balance, setBalance] = useState(0)
  const [completedToday, setCompletedToday] = useState(0)

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user)
      if (data?.user) loadAll(data.user.id)
    })
  }, [])

  const loadAll = async (userId) => {
    // Load balance
    const { data: bal } = await supabase.from('child_balances').select('balance').eq('child_id', userId).single()
    setBalance(bal?.balance || 0)

    // Load available chores
    const { data: choresData } = await supabase.from('chores').select('*').eq('is_active', true)
    setChores(choresData || [])

    // Load available rewards
    const { data: rewardsData } = await supabase.from('rewards').select('*').eq('is_available', true)
    setRewards(rewardsData || [])

    // Count completed today
    const today = new Date().toISOString().split('T')[0]
    const { data: todayTasks } = await supabase
      .from('completed_tasks')
      .select('*')
      .eq('child_id', userId)
      .gte('completed_at', `${today}T00:00:00`)
    setCompletedToday(todayTasks?.length || 0)
  }

  const completeChore = async (chore) => {
    if (!user) return

    // Record completion
    await supabase.from('completed_tasks').insert([{
      child_id: user.id,
      chore_id: chore.id,
      tokens_earned: chore.token_reward,
    }])

    // Record token transaction (this triggers the balance update via trigger)
    await supabase.from('token_transactions').insert([{
      child_id: user.id,
      type: 'chore_completed',
      amount: chore.token_reward,
      reference_id: chore.id,
      description: `Completed: ${chore.name}`,
    }])

    await loadAll(user.id)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100">
      {/* Header with balance */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-xl">👋</span>
            <span className="font-bold text-gray-800">{displayName}</span>
          </div>
          <button onClick={onLogout} className="text-sm text-gray-500">Switch</button>
        </div>
      </nav>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Token balance card */}
        <div className="bg-white rounded-2xl shadow-sm border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Your Tokens</p>
              <p className="text-4xl font-bold text-yellow-500 mt-1">{balance}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Done Today</p>
              <p className="text-2xl font-bold text-green-500 mt-1">{completedToday}</p>
            </div>
          </div>
        </div>

        {/* Available chores */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">🧹 Available Chores</h3>
          <div className="space-y-3">
            {chores.map(chore => (
              <div key={chore.id} className="bg-white p-4 rounded-xl shadow-sm border">
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-800">{chore.name}</h4>
                    {chore.description && <p className="text-sm text-gray-500 mt-1">{chore.description}</p>}
                    <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full mt-2 inline-block">+{chore.token_reward} tokens</span>
                  </div>
                  <button
                    onClick={() => completeChore(chore)}
                    className="ml-4 px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 active:scale-95 transition-all"
                  >
                    Done ✓
                  </button>
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
                    <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full mt-2 inline-block">{reward.token_cost} tokens</span>
                  </div>
                  <div className={`ml-4 px-3 py-1 rounded-full text-xs font-medium ${
                    balance >= reward.token_cost 
                      ? 'bg-green-100 text-green-700' 
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
      </main>
    </div>
  )
}
