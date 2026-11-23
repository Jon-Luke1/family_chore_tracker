export default function LandingPage({ onSelectParent, onSelectChild }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-6xl mb-4">🏠</div>
          <h1 className="text-3xl font-bold text-gray-800">Family Tracker</h1>
          <p className="text-gray-500 mt-2">Chores, Goals & Rewards</p>
        </div>
        
        <div className="space-y-4">
          <button
            onClick={onSelectParent}
            className="w-full bg-indigo-600 text-white py-5 px-6 rounded-2xl shadow-lg hover:shadow-xl hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-4"
          >
            <span className="text-3xl">👨‍👩‍👧‍👦</span>
            <div className="text-left">
              <div className="text-xl font-semibold">Parent</div>
              <div className="text-sm opacity-80">Manage chores, rewards & goals</div>
            </div>
          </button>
          
          <button
            onClick={onSelectChild}
            className="w-full bg-emerald-500 text-white py-5 px-6 rounded-2xl shadow-lg hover:shadow-xl hover:bg-emerald-600 transition-all active:scale-95 flex items-center gap-4"
          >
            <span className="text-3xl">👧</span>
            <div className="text-left">
              <div className="text-xl font-semibold">Child</div>
              <div className="text-sm opacity-80">View tasks & earn rewards</div>
            </div>
          </button>
        </div>
        
        <div className="mt-12 text-center">
          <p className="text-gray-400 text-xs">Built with ❤️ for our family</p>
        </div>
      </div>
    </div>
  )
}
