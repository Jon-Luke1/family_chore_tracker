import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import LandingPage from './components/LandingPage'
import ParentLogin from './components/ParentLogin'
import ChildSelect from './components/ChildSelect'
import ParentDashboard from './components/ParentDashboard'
import ChildView from './components/ChildView'
import './App.css'

const VIEWS = {
  LANDING: 'landing',
  PARENT_LOGIN: 'parent_login',
  CHILD_SELECT: 'child_select',
  PARENT_DASHBOARD: 'parent_dashboard',
  CHILD_VIEW: 'child_view',
}

function App() {
  const [view, setView] = useState(VIEWS.LANDING)
  const [parentName, setParentName] = useState(null)
  const [childName, setChildName] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        checkUserRole(session.user.id)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await checkUserRole(session.user.id)
      } else {
        setView(VIEWS.LANDING)
        setParentName(null)
        setChildName(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const checkUserRole = async (userId) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, display_name')
      .eq('id', userId)
      .single()
    
    if (profile) {
      if (profile.role === 'parent') {
        setParentName(profile.display_name)
        setView(VIEWS.PARENT_DASHBOARD)
      } else {
        setChildName(profile.display_name)
        setView(VIEWS.CHILD_VIEW)
      }
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setView(VIEWS.LANDING)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-xl font-semibold text-indigo-600">Loading...</div>
      </div>
    )
  }

  switch (view) {
    case VIEWS.LANDING:
      return (
        <LandingPage
          onSelectParent={() => setView(VIEWS.PARENT_LOGIN)}
          onSelectChild={() => setView(VIEWS.CHILD_SELECT)}
        />
      )
    
    case VIEWS.PARENT_LOGIN:
      return (
        <div className="relative">
          <button
            onClick={() => setView(VIEWS.LANDING)}
            className="absolute top-4 left-4 z-10 px-3 py-2 bg-white rounded-lg shadow text-sm text-gray-600 hover:text-gray-800"
          >
            ← Back
          </button>
          <ParentLogin onLogin={(name) => { setParentName(name); setView(VIEWS.PARENT_DASHBOARD) }} />
        </div>
      )
    
    case VIEWS.CHILD_SELECT:
      return (
        <div className="relative">
          <button
            onClick={() => setView(VIEWS.LANDING)}
            className="absolute top-4 left-4 z-10 px-3 py-2 bg-white rounded-lg shadow text-sm text-gray-600 hover:text-gray-800"
          >
            ← Back
          </button>
          <ChildSelect onLogin={(name) => { setChildName(name); setView(VIEWS.CHILD_VIEW) }} />
        </div>
      )
    
    case VIEWS.PARENT_DASHBOARD:
      return <ParentDashboard name={parentName} onLogout={handleLogout} />
    
    case VIEWS.CHILD_VIEW:
      return <ChildView displayName={childName} onLogout={handleLogout} />
    
    default:
      return <LandingPage onSelectParent={() => setView(VIEWS.PARENT_LOGIN)} onSelectChild={() => setView(VIEWS.CHILD_SELECT)} />
  }
}

export default App
