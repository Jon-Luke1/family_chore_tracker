import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import RefreshButton from './RefreshButton'

// Tab components
function ChoresTab() {
  const [chores, setChores] = useState([])
  const [children, setChildren] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [newChore, setNewChore] = useState({ name: '', description: '', token_reward: 10, frequency: 'daily', assigned_to: '' })
  const [addError, setAddError] = useState('')
  const [editingId, setEditingId] = useState(null) // chore being edited, or null when adding

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

  const emptyChore = { name: '', description: '', token_reward: 10, frequency: 'daily', assigned_to: '' }

  const closeForm = () => {
    setNewChore(emptyChore)
    setEditingId(null)
    setShowForm(false)
    setAddError('')
  }

  const startEdit = (chore) => {
    setNewChore({
      name: chore.name,
      description: chore.description || '',
      token_reward: chore.token_reward,
      frequency: chore.frequency,
      assigned_to: chore.assigned_to || '',
    })
    setEditingId(chore.id)
    setAddError('')
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveChore = async (e) => {
    e.preventDefault()
    setAddError('')

    const choreData = {
      ...newChore,
      assigned_to: newChore.assigned_to || null,
    }

    const { error } = editingId
      ? await supabase.from('chores').update(choreData).eq('id', editingId)
      : await supabase.from('chores').insert([{ ...choreData, is_active: true }])

    if (error) {
      console.error('Save chore error:', error)
      setAddError(`Failed to ${editingId ? 'update' : 'add'} chore: ` + error.message)
      return
    }

    closeForm()
    loadChores()
  }

  const deleteChore = async (chore) => {
    if (!window.confirm(`Delete "${chore.name}"? This can't be undone.`)) return
    const { error } = await supabase.from('chores').delete().eq('id', chore.id)
    if (error) {
      alert('Failed to delete chore: ' + error.message)
      return
    }
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
        <button onClick={() => { setNewChore(emptyChore); setEditingId(null); setShowForm(true) }} className="px-3 py-1.5 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700">
          + Add Chore
        </button>
      </div>

      {showForm && (
        <form onSubmit={saveChore} className="bg-gray-50 p-4 rounded-xl mb-4 space-y-3">
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
            <button type="submit" className="flex-1 py-2 bg-sage-600 text-white rounded-lg font-semibold">{editingId ? 'Save Changes' : 'Add Chore'}</button>
            <button type="button" onClick={closeForm} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
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
                  <span className="text-xs px-2 py-1 bg-sun-100 text-sun-700 rounded-full">{chore.token_reward} tokens</span>
                  <span className="text-xs px-2 py-1 bg-sage-100 text-sage-700 rounded-full">{chore.frequency}</span>
                  {chore.assigned_to ? (
                    <span className="text-xs px-2 py-1 bg-tan-100 text-tan-700 rounded-full">
                      Assigned: {children.find(c => c.id === chore.assigned_to)?.display_name || 'Unknown'}
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 bg-sage-100 text-sage-700 rounded-full">👆 Up for grabs</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 items-end">
                <button onClick={() => toggleActive(chore)} className={`px-3 py-1 rounded-lg text-sm ${chore.is_active ? 'bg-sage-100 text-sage-700' : 'bg-gray-200 text-gray-600'}`}>
                  {chore.is_active ? 'Active' : 'Inactive'}
                </button>
                <button onClick={() => startEdit(chore)} className="px-3 py-1 rounded-lg text-sm bg-gray-100 text-gray-700 hover:bg-gray-200">
                  Edit
                </button>
                <button onClick={() => deleteChore(chore)} className="px-3 py-1 rounded-lg text-sm bg-red-50 text-red-600 hover:bg-red-100">
                  Delete
                </button>
              </div>
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
  const [editingId, setEditingId] = useState(null) // reward being edited, or null when adding

  useEffect(() => { loadRewards() }, [])

  const loadRewards = async () => {
    const { data } = await supabase.from('rewards').select('*').order('created_at', { ascending: false })
    setRewards(data || [])
  }

  const emptyReward = { name: '', description: '', token_cost: 50 }

  const closeForm = () => {
    setNewReward(emptyReward)
    setEditingId(null)
    setShowForm(false)
    setAddError('')
  }

  const startEdit = (reward) => {
    setNewReward({
      name: reward.name,
      description: reward.description || '',
      token_cost: reward.token_cost,
    })
    setEditingId(reward.id)
    setAddError('')
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveReward = async (e) => {
    e.preventDefault()
    setAddError('')

    const { error } = editingId
      ? await supabase.from('rewards').update(newReward).eq('id', editingId)
      : await supabase.from('rewards').insert([{ ...newReward, is_available: true }])

    if (error) {
      console.error('Save reward error:', error)
      setAddError(`Failed to ${editingId ? 'update' : 'add'} reward: ` + error.message)
      return
    }

    closeForm()
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
        <button onClick={() => { setNewReward(emptyReward); setEditingId(null); setShowForm(true) }} className="px-3 py-1.5 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700">
          + Add Reward
        </button>
      </div>

      {showForm && (
        <form onSubmit={saveReward} className="bg-gray-50 p-4 rounded-xl mb-4 space-y-3">
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
            <button type="submit" className="flex-1 py-2 bg-sage-600 text-white rounded-lg font-semibold">{editingId ? 'Save Changes' : 'Add Reward'}</button>
            <button type="button" onClick={closeForm} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
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
                <span className="text-xs px-2 py-1 bg-tan-100 text-tan-700 rounded-full mt-2 inline-block">{reward.token_cost} tokens</span>
              </div>
              <div className="flex flex-col gap-2 items-end">
                <button onClick={() => toggleAvailable(reward)} className={`px-3 py-1 rounded-lg text-sm ${reward.is_available ? 'bg-sage-100 text-sage-700' : 'bg-gray-200 text-gray-600'}`}>
                  {reward.is_available ? 'Available' : 'Hidden'}
                </button>
                <button onClick={() => startEdit(reward)} className="px-3 py-1 rounded-lg text-sm bg-gray-100 text-gray-700 hover:bg-gray-200">
                  Edit
                </button>
              </div>
            </div>
          </div>
        ))}
        {rewards.length === 0 && <p className="text-center text-gray-400 py-8">No rewards yet. Add one above!</p>}
      </div>
    </div>
  )
}

function BalanceOverride({ child, onSaved }) {
  const [value, setValue] = useState(String(child.balance))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setValue(String(child.balance)) }, [child.balance])

  const save = async (e) => {
    e.preventDefault()
    const newBalance = parseInt(value, 10)
    if (Number.isNaN(newBalance) || newBalance < 0) {
      alert('Enter a balance of 0 or more')
      return
    }
    if (newBalance === child.balance) return
    if (!window.confirm(`Set ${child.display_name}'s balance from ${child.balance} to ${newBalance}?`)) return
    setSaving(true)
    const { error } = await supabase.rpc('set_child_balance', {
      p_child_id: child.id,
      p_new_balance: newBalance,
      p_note: note || null,
    })
    setSaving(false)
    if (error) {
      alert('Failed to update balance: ' + error.message)
      return
    }
    setNote('')
    onSaved()
  }

  return (
    <form onSubmit={save} className="mt-3 pt-3 border-t space-y-2">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Override balance</p>
      <div className="flex gap-2">
        <input
          type="number"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-24 px-3 py-2 border border-gray-300 rounded-lg"
          required
        />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reason (optional)"
          className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg"
        />
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
        >
          {saving ? '...' : 'Set'}
        </button>
      </div>
    </form>
  )
}

function ChildHistory({ child }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data, error: err } = await supabase
        .from('token_transactions')
        .select('id, type, amount, description, created_at')
        .eq('child_id', child.id)
        .order('created_at', { ascending: false })
        .limit(25)
      if (cancelled) return
      if (err) {
        setError(err.message)
        return
      }
      // Work backwards from the current balance: newest entry ends at the
      // current balance, and each entry's "before" is the next-newer "after".
      let after = child.balance
      setRows((data || []).map(t => {
        const row = { ...t, after, before: after - t.amount }
        after = row.before
        return row
      }))
    }
    load()
    return () => { cancelled = true }
  }, [child.id, child.balance])

  if (error) return <p className="text-sm text-red-600 mt-3">Failed to load history: {error}</p>
  if (!rows) return <p className="text-sm text-gray-400 mt-3">Loading history...</p>
  if (rows.length === 0) return <p className="text-sm text-gray-400 mt-3">No activity yet.</p>

  return (
    <div className="mt-3 pt-3 border-t space-y-2">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Recent activity</p>
      {rows.map(t => (
        <div key={t.id} className="flex justify-between items-start gap-3 text-sm">
          <div className="min-w-0">
            <div className="text-gray-800 truncate">{t.description || t.type}</div>
            <div className="text-xs text-gray-400">
              {new Date(t.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className={`font-semibold ${t.amount >= 0 ? 'text-sage-700' : 'text-red-500'}`}>
              {t.amount >= 0 ? '+' : ''}{t.amount}
            </div>
            <div className="text-xs text-gray-500">{t.before} → {t.after}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ChildrenTab({ onViewChild }) {
  const [children, setChildren] = useState([])
  const [selectedId, setSelectedId] = useState(null)

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
          <div key={child.id} className="bg-white p-4 rounded-xl border">
            <button
              onClick={() => setSelectedId(selectedId === child.id ? null : child.id)}
              className="w-full flex justify-between items-center text-left"
            >
              <div>
                <h4 className="font-medium text-gray-800">{child.display_name}</h4>
                <span className="text-xs text-gray-400">{selectedId === child.id ? '▲ Hide history' : '▼ View history'}</span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-tan-600">{child.balance}</div>
                <div className="text-xs text-gray-500">tokens</div>
              </div>
            </button>
            {selectedId === child.id && (
              <>
                <button
                  onClick={() => onViewChild(child)}
                  className="mt-3 w-full py-2 bg-forest-800 text-white rounded-lg text-sm font-semibold hover:bg-forest-700"
                >
                  Open {child.display_name}'s page (complete chores for them)
                </button>
                <BalanceOverride child={child} onSaved={loadChildren} />
                <ChildHistory child={child} />
              </>
            )}
          </div>
        ))}
        {children.length === 0 && <p className="text-center text-gray-400 py-8">No children set up yet</p>}
      </div>
    </div>
  )
}

// Main dashboard
export default function ParentDashboard({ name, onLogout, onBack, onViewChild }) {
  const [tab, setTab] = useState('chores')

  return (
    <div className="min-h-screen bg-cream">
      <nav className="bg-white shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
            <h1 className="text-xl font-bold text-forest-800">Parent Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <RefreshButton />
            <button onClick={onLogout} className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
          </div>
        </div>
      </nav>

      <main className="max-w-lg mx-auto px-4 py-6">
        <div className="bg-white rounded-3xl shadow-sm border border-forest-100 overflow-hidden">
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
                  tab === t.key ? 'text-forest-800 border-b-2 border-sun-500 bg-sage-50' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="mr-1">{t.icon}</span> {t.label}
              </button>
            ))}
          </div>
          
          <div className="p-4">
            {tab === 'chores' && <ChoresTab />}
            {tab === 'rewards' && <RewardsTab />}
            {tab === 'children' && <ChildrenTab onViewChild={onViewChild} />}
          </div>
        </div>
      </main>
    </div>
  )
}
