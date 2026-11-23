import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const CHILD_CREDENTIALS = {
  'elliott@family.local': 'child123',
  'emerson@family.local': 'child123',
}

export default function ChildSelect({ onLogin }) {
  const [children, setChildren] = useState([])
  const [loading, setLoading] = useState(false)
  const [loggingIn, setLoggingIn] = useState(null)

  useEffect(() => {
    // Fetch children from profiles - note: this requires the anon key to have select access on profiles
    // For now, we'll use hardcoded names since anon RLS blocks this
    setChildren([
      { id: 'ed1c7239-a48e-41b8-a590-3e4fbbf0c8d0', display_name: 'Elliott', color: 'bg-pink-500', emoji: '🌸' },
      { id: '14f81c44-4438-4d79-be57-5362f517fa6a', display_name: 'Emerson', color: 'bg-blue-500', emoji: '⭐' },
    ])
  }, [])

  const handleSelect = async (child) => {
    setLoggingIn(child.display_name)
    
    // Find matching credential
    const email = Object.keys(CHILD_CREDENTIALS).find(e => e.includes(child.display_name.toLowerCase()))
    if (!email) {
      alert('Could not find login info for ' + child.display_name)
      setLoggingIn(null)
      return
    }
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: CHILD_CREDENTIALS[email],
    })
    
    if (error) {
      alert('Login failed: ' + error.message)
      setLoggingIn(null)
      return
    }
    
    onLogin(child.display_name)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">👧</div>
          <h1 className="text-3xl font-bold text-gray-800">Welcome!</h1>
          <p className="text-gray-500 mt-2">Tap your name to continue</p>
        </div>
        
        <div className="space-y-4">
          {children.map((child) => (
            <button
              key={child.id}
              onClick={() => handleSelect(child)}
              disabled={loading}
              className={`w-full ${child.color} text-white py-6 px-6 rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center gap-4`}
            >
              <span className="text-3xl">{child.emoji}</span>
              <span className="text-xl font-semibold">{child.display_name}</span>
              {loggingIn === child.display_name && (
                <span className="ml-auto text-sm opacity-75">Loading...</span>
              )}
            </button>
          ))}
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm">🔒 Child accounts are safe and simple</p>
        </div>
      </div>
    </div>
  )
}
