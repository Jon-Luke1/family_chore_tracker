import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ParentLogin({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (loginError) {
      setError(loginError.message)
      setLoading(false)
      return
    }
    
    // Immediately navigate - onAuthStateChange will verify the role
    onLogin('Parent')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">👨‍👩‍👧‍👦</div>
          <h1 className="text-2xl font-bold text-gray-800">Family Tracker</h1>
          <p className="text-gray-500 mt-1">Parent Login</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-sage-500 focus:border-transparent"
              placeholder="parent@email.com"
              required
              autoComplete="email"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-sage-500 focus:border-transparent"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-sage-600 text-white rounded-full font-semibold tracking-wide hover:bg-sage-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
