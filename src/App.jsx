import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import LandingPage from './components/LandingPage'
import ParentLogin from './components/ParentLogin'
import ChildLogin from './components/ChildLogin'
import ParentDashboard from './components/ParentDashboard'
import ChildView from './components/ChildView'
import './App.css'

const VIEWS = {
  LANDING: 'landing',
  PARENT_LOGIN: 'parent_login',
  CHILD_SELECT: 'child_select',
  PARENT_DASHBOARD: 'parent_dashboard',
  CHILD_VIEW: 'child_view',
  CHILD_AS_PARENT: 'child_as_parent',
}

function App() {
  const [view, setView] = useState(VIEWS.LANDING)
  const [parentName, setParentName] = useState(null)
  const [childName, setChildName] = useState(null)
  const [viewingChild, setViewingChild] = useState(null) // child a parent is viewing
  const [loading, setLoading] = useState(true)
  const [authCheckInProgress, setAuthCheckInProgress] = useState(false)

  // Check role and route to correct dashboard
  const checkUserRole = async (userId) => {
    if (authCheckInProgress) {
      console.log('Auth check already in progress, skipping')
      return
    }
    setAuthCheckInProgress(true)

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, display_name')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Profile lookup error:', error)
      } else if (profile) {
        console.log('Found profile:', profile.role, profile.display_name)
        if (profile.role === 'parent') {
          setParentName(profile.display_name)
          // Don't pull a parent out of a child's page on a background auth refresh
          setView(v => (v === VIEWS.CHILD_AS_PARENT ? v : VIEWS.PARENT_DASHBOARD))
        } else {
          setChildName(profile.display_name)
          setView(VIEWS.CHILD_VIEW)
        }
      } else {
        console.log('No profile found for user:', userId)
      }
    } catch (e) {
      console.error('Unexpected error:', e)
    } finally {
      setAuthCheckInProgress(false)
    }
  }

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        checkUserRole(session.user.id)
      }
      setLoading(false)
    })

    // Listen for auth changes
    let mounted = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return

      if (session?.user) {
        await checkUserRole(session.user.id)
      } else {
        setView(VIEWS.LANDING)
        setParentName(null)
        setChildName(null)
      }
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // If this device already has a session for the chosen role, skip the login screen
  const resumeSession = async (role, fallbackView) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, display_name')
        .eq('id', session.user.id)
        .single()
      if (profile?.role === role) {
        if (role === 'parent') {
          setParentName(profile.display_name)
          setView(VIEWS.PARENT_DASHBOARD)
        } else {
          setChildName(profile.display_name)
          setView(VIEWS.CHILD_VIEW)
        }
        return
      }
    }
    setView(fallbackView)
  }

  const handleSelectParent = () => resumeSession('parent', VIEWS.PARENT_LOGIN)
  const handleSelectChild = () => resumeSession('child', VIEWS.CHILD_SELECT)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setView(VIEWS.LANDING)
    setParentName(null)
    setChildName(null)
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
          onSelectParent={handleSelectParent}
          onSelectChild={handleSelectChild}
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
          <ParentLogin
            onLogin={(name) => {
              setParentName(name)
              setView(VIEWS.PARENT_DASHBOARD)
            }}
          />
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
          <ChildLogin
            onLogin={(name) => {
              setChildName(name)
              setView(VIEWS.CHILD_VIEW)
            }}
          />
        </div>
      )

    case VIEWS.PARENT_DASHBOARD:
      return <ParentDashboard
          name={parentName}
          onLogout={handleLogout}
          onBack={() => setView(VIEWS.LANDING)}
          onViewChild={(child) => {
            setViewingChild({ id: child.id, name: child.display_name })
            setView(VIEWS.CHILD_AS_PARENT)
          }}
        />

    case VIEWS.CHILD_AS_PARENT:
      return (
        <ChildView
          childId={viewingChild?.id}
          displayName={viewingChild?.name}
          onExit={() => setView(VIEWS.PARENT_DASHBOARD)}
        />
      )

    case VIEWS.CHILD_VIEW:
      return <ChildView displayName={childName} onLogout={handleLogout} />

    default:
      return <LandingPage
        onSelectParent={handleSelectParent}
        onSelectChild={handleSelectChild}
      />
  }
}

export default App
