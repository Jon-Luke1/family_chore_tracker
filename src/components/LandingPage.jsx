export default function LandingPage({ onSelectParent, onSelectChild }) {
  return (
    <div className="min-h-screen bg-forest-800 flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-24 text-center">
        <div className="w-20 h-20 rounded-full bg-sun-500 flex items-center justify-center text-4xl shadow-lg mb-6">🏠</div>
        <h1 className="text-4xl font-bold text-white">Family Tracker</h1>
        <p className="text-sage-300 mt-3 tracking-wide">Chores, Goals &amp; Rewards</p>
      </div>

      {/* Sheet */}
      <div className="bg-white rounded-t-[2.5rem] px-6 pt-8 pb-10 -mt-12 shadow-2xl">
        <div className="w-full max-w-sm mx-auto space-y-4">
          <button
            onClick={onSelectParent}
            className="w-full bg-sage-600 text-white py-5 px-6 rounded-3xl shadow-md hover:shadow-lg hover:bg-sage-700 transition-all active:scale-95 flex items-center gap-4"
          >
            <span className="text-3xl">👨‍👩‍👧‍👦</span>
            <div className="text-left">
              <div className="text-xl font-semibold">Parent</div>
              <div className="text-sm opacity-90">Manage chores, rewards &amp; goals</div>
            </div>
          </button>

          <button
            onClick={onSelectChild}
            className="w-full bg-forest-800 text-white py-5 px-6 rounded-3xl shadow-md hover:shadow-lg hover:bg-forest-700 transition-all active:scale-95 flex items-center gap-4"
          >
            <span className="text-3xl">👧</span>
            <div className="text-left">
              <div className="text-xl font-semibold">Child</div>
              <div className="text-sm opacity-90">View tasks &amp; earn rewards</div>
            </div>
          </button>

          <p className="pt-4 text-center text-gray-400 text-xs">Built with ❤️ for our family</p>
        </div>
      </div>
    </div>
  )
}
