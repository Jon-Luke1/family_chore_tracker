import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Avatar from './Avatar'

const COLORS = ['bg-sage-600 text-white', 'bg-forest-800 text-white', 'bg-tan-500 text-white', 'bg-sun-500 text-forest-800']
const EMOJIS = ['🌸', '⭐', '🌈', '🚀']

// Shown only to a signed-in parent (RLS stops anyone else from listing children).
export default function ChildPicker({ onPick }) {
  const [children, setChildren] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('profiles').select('id, display_name').eq('role', 'child').order('display_name')
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setChildren(data || [])
      })
  }, [])

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">👧</div>
          <h1 className="text-3xl font-bold text-gray-800">Whose page?</h1>
          <p className="text-gray-500 mt-2">You can complete chores for them</p>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">{error}</div>}
        {!children && !error && <p className="text-center text-gray-400">Loading...</p>}

        <div className="space-y-4">
          {(children || []).map((child, i) => (
            <button
              key={child.id}
              onClick={() => onPick(child)}
              className={`w-full ${COLORS[i % COLORS.length]} py-6 px-6 rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center gap-4`}
            >
              <Avatar
                childId={child.id}
                name={child.display_name}
                size={48}
                fallback={<span className="text-3xl">{EMOJIS[i % EMOJIS.length]}</span>}
              />
              <span className="text-xl font-semibold">{child.display_name}</span>
            </button>
          ))}
          {children && children.length === 0 && (
            <p className="text-center text-gray-400">No children set up yet</p>
          )}
        </div>
      </div>
    </div>
  )
}
