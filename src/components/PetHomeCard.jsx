import { useState, useEffect, useCallback } from 'react'
import { petMood } from '../lib/petArt'
import { petApi } from '../lib/pets'
import PetSprite from './PetSprite'

const SHORT_MOOD = {
  happy: 'Happy 🥰',
  content: 'Doing okay',
  hungry: 'Hungry!',
  dirty: 'Needs a bath',
  sleepy: 'Sleepy',
  sad: 'Needs love',
  sick: 'Very sick!',
  dead: 'Passed away',
}

// A peek at the child's pets on the chores screen: how each one is feeling right now.
// Tapping it opens the pet page. Renders nothing until the child has a pet.
export default function PetHomeCard({ onOpen, childId = null }) {
  const [status, setStatus] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await (childId ? petApi.statusFor(childId) : petApi.status())
    if (!error) setStatus({ ...data, loadedAt: Date.now() })
  }, [childId])

  useEffect(() => {
    load()
    const timer = setInterval(load, 60000)
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  const pets = status?.pets || []
  if (pets.length === 0) return null

  const checkinReady = !childId && (!status.checkin_ready_at || new Date(status.checkin_ready_at).getTime() <= Date.now())

  return (
    <button
      onClick={onOpen}
      className="w-full text-left bg-gradient-to-b from-sage-100 to-tan-50 border rounded-3xl p-4 shadow-sm active:scale-[0.99] transition-transform"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-forest-800">{pets.length === 1 ? 'Your pet' : 'Your pets'}</h3>
        {checkinReady ? (
          <span className="text-xs font-semibold bg-sun-500 text-white rounded-full px-2.5 py-1">
            🎁 +{status.checkin_bonus || 5} for checking in
          </span>
        ) : (
          <span className="text-xs text-forest-700">Visit →</span>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto">
        {pets.map(p => {
          const mood = petMood(p)
          return (
            <div key={p.id} className="shrink-0 flex flex-col items-center w-24">
              <PetSprite
                species={p.species_id}
                mood={mood}
                collar={p.collar}
                head={p.head}
                face={p.face}
                level={p.level}
                size={88}
                className={mood === 'happy' ? 'pet-bob' : ''}
              />
              <p className="text-sm font-semibold text-forest-800 truncate max-w-full">{p.name}</p>
              <p className="text-[11px] text-gray-500">Lv {p.level}</p>
              <p className={`text-xs font-medium ${mood === 'happy' || mood === 'content' ? 'text-sage-700' : mood === 'dead' ? 'text-gray-500' : 'text-red-600'}`}>
                {SHORT_MOOD[mood]}
              </p>
            </div>
          )
        })}
      </div>
    </button>
  )
}
