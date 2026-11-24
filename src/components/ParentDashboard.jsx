import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Tab components
function ChoresTab() {
  const [chores, setChores] = useState([])
  const [children, setChildren] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [newChore, setNewChore] = useState({ name: '', description: '', token_reward: 10, frequency: 'daily', assigned_to: '' })
  const [addError, setAddError] = useState('')

  useEffect(() => {
    loadChores()
    loadChildren()
  }, [])

  const loadChores = async () => {
    const { data } = await supabase.from('chores').select('*').order('created_at', { ascending: false })
    setChores(data || [])
  }

  const loadChildren = async () => {
    const { data } = await supabase.from('profiles').select('id, display_name').eq('role', 'child')
    setChildren(data || [])
  }

  const addChore = async (e) => {
    e.preventDefault()
    setAddError('')
    
    const choreData = {
      ...newChore,
      is_active: true,
      assigned_to: newChore.assigned_to || null,
    }
    
    const { error } = await supabase.from('chores').insert([choreData])
    
    if (error) {
      console.error('Add chore error:', error)
      setAddError('Failed to add chore: ' + error.message)
      return
    }
    
    setNewChore({ name: '', description: '', token_reward: 10, frequency: 'daily', assigned_to: '' })
    setShowForm(false)
    loadChores()
  }

  const toggleActive = async (chore) => {
    await supabase.from('chores').update({ is_active: !chore.is_active }).eq('id', chore.id)
    loadChores()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Chores</h3>
        <button onClick={() => setShowForm(true)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
          + Add Chore
        </button>
      </div>

      {showForm && (
        <form onSubmit={addChore} className="bg-gray-50 p-4 rounded-xl mb-4 space-y-3">
          {addError && <div className="bg-red-50 text-red-600 p-2 rounded-lg text-sm">{addError}</div>}
          
          <input
            type="text"
            placeholder="Chore name"
            value={newChore.name}
            onChange={(e) => setNewChore({ ...newChore, name: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
            required
          />
          <textarea
            placeholder="Description (optional)"
            value={newChore.description}
            onChange={(e) => setNewChore({ ...newChore, description: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
            rows="2"
          />
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Tokens</label>
              <input
                type="number"
                value={newChore.token_reward}
                onChange={(e) => setNewChore({ ...newChore, token_reward: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg"
                min="1"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Frequency</label>
              <select
                value={newChore.frequency}
                onChange={(e) => setNewChore({ ...newChore, frequency: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="once">Once</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Assign to</label>
            <select
              value={newChore.assigned_to}
              onChange={(e) => setNewChore({ ...newChore, assigned_to: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Up for grabs (any child)</option>
              {children.map(c => (
                <option key={c.id} value={c.id}>{c.display_name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-semibold">Add Chore</button>
            <button type="button" onClick={() => { setShowForm(false); setAddError('') }} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {chores.map(chore => (
          <div key={chore.id} className={`p-4 rounded-xl border ${chore.is_active ? 'bg-white' : 'bg-gray-100'}`}>
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-medium text-gray-800">{chore.name}</h4>
                {chore.description && <p className="text-sm text-gray-500 mt-1">{chore.description}</p>}
                <div className="flex gap-2 mt-2 flex-wrap">
                  <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">{chore.token_reward} tokens</span>
                  <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">{chore.frequency}</span>
                  {chore.assigned_to ? (
                    <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                      Assigned: {children.find(c => c.id === chore.assigned_to)?.display_name || 'Unknown'}
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">👆 Up for grabs</span>
                  )}
                </div>
              </div>
              <button onClick={() => toggleActive(chore)} className={`px-3 py-1 rounded-lg text-sm ${chore.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                {chore.is_active ? 'Active' : 'Inactive'}
              </button>
            </div>
          </div>
        ))}
        {chores.length === 0 && <p className="text-center text-gray-400 py-8">No chores yet. Add one above!</p>}
      </div>
    </div>
  )
}

function RewardsTab() {
  const [rewards, setRewards] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [newReward, setNewReward] = useState({ name: '', description: '', token_cost: 50 })
  const [addError, setAddError] = useState('')

  useEffect(() => { loadRewards() }, [])

  const loadRewards = async () => {
    const { data } = await supabase.from('rewards').select('*').order('created_at', { ascending: false })
    setRewards(data || [])
  }

  const addReward = async (e) => {
    e.preventDefault()
    setAddError('')
    
    const { error } = await supabase.from('rewards').insert([{ ...newReward, is_available: true }])
    
    if (error) {
      console.error('Add reward error:', error)
      setAddError('Failed to add reward: ' + error.message)
      return
    }
    
    setNewReward({ name: '', description: '', token_cost: 50 })
    setShowForm(false)
    loadRewards()
  }

  const toggleAvailable = async (reward) => {
    await supabase.from('rewards').update({ is_available: !reward.is_available }).eq('id', reward.id)
    loadRewards()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Rewards</h3>
        <button onClick={() => setShowForm(true)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
          + Add Reward
        </button>
      </div>

      {showForm && (
        <form onSubmit={addReward} className="bg-gray-50 p-4 rounded-xl mb-4 space-y-3">
          {addError && <div className="bg-red-50 text-red-600 p-2 rounded-lg text-sm">{addError}</div>}
          
          <input
            type="text"
            placeholder="Reward name"
            value={newReward.name}
            onChange={(e) => setNewReward({ ...newReward, name: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
            required
          />
          <textarea
            placeholder="Description"
            value={newReward.description}
            onChange={(e) => setNewReward({ ...newReward, description: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
            rows="2"
          />
          <div>
            <label className="block text-xs text-gray-500 mb-1">Token Cost</label>
            <input
              type="number"
              value={newReward.token_cost}
              onChange={(e) => setNewReward({ ...newReward, token_cost: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg"
              min="1"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-semibold">Add Reward</button>
            <button type="button" onClick={() => { setShowForm(false); setAddError('') }} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {rewards.map(reward => (
          <div key={reward.id} className={`p-4 rounded-xl border ${reward.is_available ? 'bg-white' : 'bg-gray-100'}`}>
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-medium text-gray-800">{reward.name}</h4>
                {reward.description && <p className="text-sm text-gray-500 mt-1">{reward.description}</p>}
                <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full mt-2 inline-block">{reward.token_cost} tokens</span>
              </div>
              <button onClick={() => toggleAvailable(reward)} className={`px-3 py-1 rounded-lg text-sm ${reward.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                {reward.is_available ? 'Available' : 'Hidden'}
              </button>
            </div>
          </div>
        ))}
        {rewards.length === 0 && <p className="text-center text-gray-400 py-8">No rewards yet. Add one above!</p>}
      </div>
    </div>
  )
}

function ChildrenTab() {
  const [children, setChildren] = useState([])

  useEffect(() => {
    loadChildren()
  }, [])

  const loadChildren = async () => {
    const { data: profiles } = await supabase.from('profiles').select('*').eq('role', 'child')
    const { data: balances } = await supabase.from('child_balances').select('*')
    const merged = (profiles || []).map(p => ({
      ...p,
      balance: (balances || []).find(b => b.child_id === p.id)?.balance || 0
    }))
    setChildren(merged)
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Children</h3>
      <div className="space-y-3">
        {children.map(child => (
          <div key={child.id} className="bg-white p-4 rounded-xl border flex justify-between items-center">
            <div>
              <h4 className="font-medium text-gray-800">{child.display_name}</h4>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-yellow-500">{child.balance}</div>
              <div className="text-xs text-gray-500">tokens</div>
            </div>
          </div>
        ))}
        {children.length === 0 && <p className="text-center text-gray-400 py-8">No children set up yet</p>}
      </div>
    </div>
  )
}

// Main dashboard
export default function ParentDashboard({ name, onLogout, onBack }) {
  const [tab, setTab] = useState('chores')

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
            <h1 className="text-xl font-bold text-indigo-600">Parent Dashboard</h1>
          </div>
          <button onClick={onLogout} className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </div>
      </nav>

      <main className="max-w-lg mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="flex border-b">
            {[
              { key: 'chores', label: 'Chores', icon: '🧹' },
              { key: 'rewards', label: 'Rewards', icon: '🎁' },
              { key: 'children', label: 'Children', icon: '👧' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  tab === t.key ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="mr-1">{t.icon}</span> {t.label}
              </button>
            ))}
          </div>
          
          <div className="p-4">
            {tab === 'chores' && <ChoresTab />}
            {tab === 'rewards' && <RewardsTab />}
            {tab === 'children' && <ChildrenTab />}
          </div>
        </div>
      </main>
    </div>
  )
}
