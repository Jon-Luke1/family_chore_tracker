import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { petMood, ageStage } from '../lib/petArt'
import {
  CATEGORIES, CATEGORY, WEARABLE, TIERS, MOOD_TEXT, KIND_LABEL, SPECIES_TIERS, SEASONS,
  levelReward, describeEffects, petApi, formatSpan,
} from '../lib/pets'
import PetSprite from './PetSprite'
import { playSound, isMuted, setMuted } from '../lib/petSounds'

const CARE_ACTIONS = ['food', 'treat', 'toy', 'groom', 'bed']
// What the pet does after each care action, and for how long (ms)
const ACTIVITY_OF = { food: 'eating', treat: 'snacking', toy: 'playing', groom: 'bathing', bed: 'sleeping' }
const ACTIVITY_MS = { eating: 3000, snacking: 2600, playing: 3200, bathing: 3000, sleeping: 4000, cuddling: 3200 }
const ACTIVITY_CLASS = {
  eating: 'pet-chomp', snacking: 'pet-chomp', playing: 'pet-hop',
  bathing: 'pet-wiggle', sleeping: 'pet-breathe', cuddling: 'pet-sway',
}
const ACTIVITY_TEXT = {
  eating: (n) => `${n} is munching away...`,
  snacking: (n) => `${n} is crunching a treat...`,
  playing: (n) => `${n} is playing!`,
  bathing: (n) => `${n} is getting squeaky clean...`,
  sleeping: (n) => `${n} is napping... zzz`,
  cuddling: (n) => `${n} is cuddling with you!`,
}
const CARE_SOUND = { food: 'eat', treat: 'treat', toy: 'toy', groom: 'groom', bed: 'sleep' }
const TIER_NOTE = { 1: '🐶🐱 Dogs & cats', 2: '🦎 Exotic pets' }

// Shown while a pet is very sick: two or more bars are empty and the clock is ticking
function SickBanner({ pet, now }) {
  const left = new Date(pet.dies_at).getTime() - now
  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-sm text-red-800">
      <p className="font-semibold">⚠️ {pet.name} is very sick!</p>
      <p className="mt-1">
        Two or more needs are empty, and {pet.name} may not make it much longer. Look after them within{' '}
        <span className="font-bold">{formatSpan(left)}</span> by filling the empty bars until only one is left empty.
      </p>
    </div>
  )
}

// Shown for a pet that has died
function ReviveBox({ pet, tokens, busy, onRevive }) {
  const cost = pet.revive_cost
  return (
    <div className="bg-gray-50 border rounded-2xl p-4 text-center space-y-2">
      <p className="font-semibold text-gray-800">💔 {pet.name} passed away</p>
      <p className="text-sm text-gray-500">
        {pet.name} wasn&apos;t looked after in time. You can bring them back for what they cost to adopt.
        Their name, level and clothes will be kept.
      </p>
      <button
        onClick={onRevive}
        disabled={busy || tokens < cost}
        className="px-5 py-2 bg-sun-500 text-white rounded-full text-sm font-semibold disabled:opacity-40"
      >
        ✨ Revive {pet.name} · 🐾 {cost}
      </button>
      {tokens < cost && <p className="text-xs text-gray-400">You need {cost - tokens} more Pet Tokens.</p>}
    </div>
  )
}

// Tells the child when the next check-in bonus is ready
function CheckinNote({ status }) {
  const bonus = status.checkin_bonus || 5
  const wait = status.checkin_ready_at
    ? Math.ceil((new Date(status.checkin_ready_at).getTime() - status.loadedAt) / 60000)
    : 0
  return (
    <p className="text-xs text-gray-500 text-center">
      {wait > 0
        ? `🎁 Check-in bonus: +${bonus} Pet Tokens again in ${wait} min`
        : `🎁 Check-in bonus ready: +${bonus} Pet Tokens`}
    </p>
  )
}

function StatBar({ icon, label, value }) {
  const v = Math.round(value)
  const color = v >= 60 ? 'bg-sage-500' : v >= 30 ? 'bg-sun-500' : 'bg-red-400'
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>{icon} {label}</span>
        <span>{v}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${v}%` }} />
      </div>
    </div>
  )
}

function TierBadge({ tier }) {
  const t = TIERS[tier] || TIERS[1]
  return <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${t.badge}`}>{t.label}</span>
}

function PetTokens({ tokens }) {
  return (
    <div className="bg-forest-800 rounded-3xl shadow-md px-5 py-4 flex items-center justify-between">
      <div>
        <p className="text-sm text-sage-300">Pet Tokens</p>
        <div className="flex items-center gap-3 mt-1">
          <span className="w-9 h-9 rounded-full bg-sun-500 flex items-center justify-center text-lg">🐾</span>
          <p className="text-4xl font-bold text-sun-500 font-serif">{tokens}</p>
        </div>
      </div>
      <p className="text-xs text-sage-300 text-right max-w-[10rem]">
        You earn 1 Pet Token for every token you earn, plus bonuses when a pet levels up!
      </p>
    </div>
  )
}

// The pet's level, its age, and how close it is to the next level
function LevelHeader({ pet, flashKey }) {
  const stage = ageStage(pet.level)
  const maxed = pet.xp_next == null
  const into = pet.xp - pet.xp_floor
  const span = maxed ? 1 : pet.xp_next - pet.xp_floor
  const pct = maxed ? 100 : Math.min(100, Math.round((into / span) * 100))
  return (
    <div className="w-full max-w-xs mb-1">
      <div className="flex items-center justify-between mb-1">
        <span key={flashKey} className={`text-sm font-bold text-forest-800 bg-sun-100 px-3 py-0.5 rounded-full ${flashKey ? 'pet-levelup' : ''}`}>
          ⭐ Level {pet.level}{maxed ? ' · MAX' : ''}
        </span>
        <span className="text-xs text-gray-500">{stage.label}</span>
      </div>
      <div className="h-2.5 rounded-full bg-white/70 overflow-hidden border border-white">
        <div className="h-full rounded-full bg-sun-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-gray-500 text-center mt-0.5">
        {maxed ? 'Max level reached!' : `${into} / ${span} XP to level ${pet.level + 1}`}
      </p>
    </div>
  )
}

// Hours of good care so far today: every full 24 hours with no empty bar earns 100 XP
function CareStreak({ pet, now }) {
  const hours = pet.care_since ? Math.max(0, (now - new Date(pet.care_since).getTime()) / 3600000) : null
  const shown = hours === null ? 0 : Math.min(24, hours)
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>⭐ Daily care</span>
        <span>{hours === null ? 'Not started' : `${Math.floor(shown)}h / 24h`}</span>
      </div>
      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full bg-sun-500 transition-all duration-500" style={{ width: `${(shown / 24) * 100}%` }} />
      </div>
      <p className="text-[11px] text-gray-500 mt-1">
        {hours === null
          ? 'Get every bar above 0% to start your daily care streak.'
          : 'Keep every bar above 0% for 24 hours to earn +100 XP!'}
      </p>
    </div>
  )
}

// Row of your pets to switch between (plus a button to adopt another)
function PetSwitcher({ pets, selectedId, onSelect, canAdd, onAdd }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {pets.map(p => (
        <button
          key={p.id}
          onClick={() => onSelect(p.id)}
          className={`shrink-0 flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full border bg-white ${
            p.id === selectedId ? 'border-sun-500 ring-2 ring-sun-200' : ''
          }`}
        >
          <PetSprite species={p.species_id} mood={petMood(p)} level={p.level} size={36} />
          <span className="text-sm font-medium text-gray-800">{p.name}</span>
          <span className="text-[10px] text-gray-400">Lv {p.level}</span>
        </button>
      ))}
      {canAdd && (
        <button onClick={onAdd} className="shrink-0 px-3 py-1 rounded-full border border-dashed border-sage-500 text-sm text-sage-700 bg-white">
          ＋ Adopt
        </button>
      )}
    </div>
  )
}

// Pick a breed, then name it. Used for the first pet and any extras.
function PetStore({ species, tokens, onAdopt, busy, onCancel }) {
  const [chosen, setChosen] = useState(null)
  const [name, setName] = useState('')

  const cost = chosen?.cost ?? 25
  const canAfford = tokens >= cost
  const tiers = [...new Set(species.map(s => s.tier))].sort()

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">🐾 Pet Store</h3>
          <p className="text-sm text-gray-500">Pick a pet to adopt and give it a name.</p>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="shrink-0 px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold">
            ← Back
          </button>
        )}
      </div>

      {tiers.map(tier => (
        <div key={tier} className="space-y-3">
          <div>
            <h4 className="font-semibold text-forest-800">{SPECIES_TIERS[tier]?.title || `Tier ${tier}`}</h4>
            {SPECIES_TIERS[tier] && <p className="text-xs text-gray-500">{SPECIES_TIERS[tier].note}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {species.filter(sp => sp.tier === tier).map(sp => (
              <button
                key={sp.id}
                onClick={() => { setChosen(sp); setName('') }}
                className="bg-white rounded-2xl border shadow-sm p-3 flex flex-col items-center hover:border-sun-500 active:scale-95 transition-all"
              >
                <PetSprite species={sp.id} mood="happy" size={110} />
                <span className="font-semibold text-gray-800 mt-1 text-sm text-center">{sp.name}</span>
                <span className="text-xs text-gray-400">{KIND_LABEL[sp.kind] || sp.kind}</span>
                <span className="mt-2 text-xs px-2.5 py-1 rounded-full bg-sun-100 text-sun-700 font-semibold">🐾 {sp.cost}</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {chosen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={() => setChosen(null)}>
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center">
              <PetSprite species={chosen.id} mood="happy" level={1} size={170} className="pet-bob" />
              <h4 className="font-bold text-forest-800 text-lg">{chosen.name}</h4>
              <p className="text-xs text-gray-500">Starts as a baby and grows as you level up!</p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Give your new pet a name</label>
              <input
                autoFocus
                value={name}
                maxLength={20}
                onChange={e => setName(e.target.value)}
                placeholder="Name"
                className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sun-500"
              />
            </div>
            {!canAfford && (
              <p className="text-sm text-red-600 text-center">You need {cost - tokens} more Pet Tokens to adopt {chosen.name}.</p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setChosen(null)} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-semibold">
                Back
              </button>
              <button
                disabled={!canAfford || !name.trim() || busy}
                onClick={async () => { if (await onAdopt(chosen, name)) setChosen(null) }}
                className="flex-1 py-3 rounded-xl bg-sage-600 text-white font-semibold disabled:opacity-40"
              >
                Adopt for 🐾 {cost}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Parent test mode only: drag the sliders to set a pet's stats and level and watch how it reacts
const TEST_STATS = [
  { key: 'fullness', icon: '🍗', label: 'Food', param: 'p_fullness' },
  { key: 'love', icon: '💖', label: 'Love', param: 'p_love' },
  { key: 'clean', icon: '🫧', label: 'Clean', param: 'p_clean' },
  { key: 'rest', icon: '💤', label: 'Rest', param: 'p_rest' },
]

function TestControls({ pet, onChanged }) {
  const [draft, setDraft] = useState({})
  const [levelDraft, setLevelDraft] = useState(null)
  const [error, setError] = useState('')
  const timer = useRef(null)
  const levelTimer = useRef(null)
  useEffect(() => () => {
    clearTimeout(timer.current)
    clearTimeout(levelTimer.current)
  }, [])

  // Wait for the slider to settle, then save and refresh
  const commit = (vals) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const args = Object.fromEntries(TEST_STATS.map(s => [s.param, vals[s.key] ?? null]))
      const { error: rpcError } = await supabase.rpc('pet_test_set_stats', { p_pet_id: pet.id, ...args })
      setError(rpcError ? rpcError.message : '')
      await onChanged()
      setDraft({})
    }, 300)
  }
  const change = (key, value) => {
    const next = { ...draft, [key]: value }
    setDraft(next)
    commit(next)
  }
  const preset = (value) => {
    const all = Object.fromEntries(TEST_STATS.map(s => [s.key, value]))
    setDraft(all)
    commit(all)
  }
  const changeLevel = (value) => {
    setLevelDraft(value)
    clearTimeout(levelTimer.current)
    levelTimer.current = setTimeout(async () => {
      const { error: rpcError } = await supabase.rpc('pet_test_set_level', { p_pet_id: pet.id, p_level: value })
      setError(rpcError ? rpcError.message : '')
      await onChanged()
      setLevelDraft(null)
    }, 300)
  }
  const makeSick = async (hours) => {
    const { error: rpcError } = await supabase.rpc('pet_test_set_critical', { p_pet_id: pet.id, p_hours: hours })
    setError(rpcError ? rpcError.message : '')
    await onChanged()
    setDraft({})
  }
  const levelValue = levelDraft ?? pet.level

  return (
    <div className="bg-sun-50 border border-sun-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-sun-800">🧪 Test controls</p>
        <div className="flex gap-1.5">
          {[['Empty', 0], ['Half', 50], ['Full', 100]].map(([label, v]) => (
            <button key={label} type="button" onClick={() => preset(v)} className="px-2.5 py-1 text-xs bg-white border rounded-lg text-gray-600 active:scale-95">
              {label}
            </button>
          ))}
        </div>
      </div>
      {TEST_STATS.map(s => {
        const value = draft[s.key] ?? Math.round(pet[s.key])
        return (
          <label key={s.key} className="flex items-center gap-3 text-sm text-gray-700">
            <span className="w-16 shrink-0">{s.icon} {s.label}</span>
            <input
              type="range"
              min="0"
              max="100"
              value={value}
              onChange={e => change(s.key, Number(e.target.value))}
              className="flex-1 min-w-0 accent-sage-600"
            />
            <span className="w-8 text-right tabular-nums text-xs text-gray-500">{value}</span>
          </label>
        )
      })}
      <label className="flex items-center gap-3 text-sm text-gray-700 pt-1 border-t border-sun-200">
        <span className="w-16 shrink-0">⭐ Level</span>
        <input
          type="range"
          min="1"
          max="30"
          value={levelValue}
          onChange={e => changeLevel(Number(e.target.value))}
          className="flex-1 min-w-0 accent-sage-600"
        />
        <span className="w-8 text-right tabular-nums text-xs text-gray-500">{levelValue}</span>
      </label>
      <div className="pt-1 border-t border-sun-200">
        <p className="text-xs text-gray-600 mb-1.5">🤒 Make {pet.name} very sick, as if it had been that way for:</p>
        <div className="flex gap-1.5 flex-wrap">
          {[[0, 'Just now'], [24, '24h'], [47, '47h'], [49, '49h (dies)']].map(([h, label]) => (
            <button key={h} type="button" onClick={() => makeSick(h)} className="px-2.5 py-1 text-xs bg-white border rounded-lg text-gray-600 active:scale-95">
              {label}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-xs text-gray-500">Changes save as you drag. Stats drift down from there as normal, and the level slider pays no bonus tokens.</p>
    </div>
  )
}

// `banner` is an optional note shown on top, and `testMode` adds the test sliders (parent test mode)
// `viewChildId` is set when a parent looks at a child's pets: the same screens, but look only.
export default function PetPage({ onTokensChange, banner, testMode = false, viewChildId = null, viewName = '' }) {
  const readOnly = Boolean(viewChildId)
  const [status, setStatus] = useState(null)
  const [species, setSpecies] = useState([])
  const [items, setItems] = useState([])
  const [loadError, setLoadError] = useState('')
  const [tab, setTab] = useState('home')
  const [shopCat, setShopCat] = useState('food')
  const [picker, setPicker] = useState(null) // which care action's item list is open
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const [fx, setFx] = useState(null)
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [soundOff, setSoundOff] = useState(isMuted())
  const [activity, setActivity] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [levelFlash, setLevelFlash] = useState({ id: null, key: 0 })
  const toastTimer = useRef(null)
  const greeted = useRef(false)
  const activityTimer = useRef(null)
  const sceneRef = useRef(null)
  const knownLevels = useRef(null)
  const onLevelUp = useRef(null)
  const onCheckedIn = useRef(null)

  const loadStatus = useCallback(async () => {
    const { data, error } = await (viewChildId ? petApi.statusFor(viewChildId) : petApi.status())
    if (error) {
      setLoadError(error.message)
      return
    }
    setLoadError('')
    setStatus({ ...data, loadedAt: Date.now() })
    if (onTokensChange) onTokensChange(data.tokens)

    // Spot pets that gained a level since the last check (from care or a full day of good care)
    const before = knownLevels.current
    knownLevels.current = Object.fromEntries(data.pets.map(p => [p.id, p.level]))
    if (before) {
      for (const p of data.pets) {
        if (before[p.id] != null && p.level > before[p.id] && onLevelUp.current) onLevelUp.current(p, before[p.id])
      }
    }
  }, [onTokensChange, viewChildId])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [sp, it] = await Promise.all([
        supabase.from('pet_species').select('*').order('sort'),
        supabase.from('pet_items').select('*').eq('is_available', true).order('sort'),
      ])
      if (!alive) return
      setSpecies(sp.data || [])
      setItems(it.data || [])
    })()
    return () => { alive = false }
  }, [])

  // Stats drift over time, so refresh now, every minute, and when the tab comes back
  // Opening the page (or coming back to it) is a check-in: 5 Pet Tokens, at most once an hour
  const checkIn = useCallback(async () => {
    if (readOnly) return
    const { data } = await petApi.checkin()
    if (data?.awarded > 0) {
      await loadStatus()
      if (onCheckedIn.current) onCheckedIn.current(data.awarded)
    }
  }, [loadStatus, readOnly])

  useEffect(() => {
    loadStatus()
    checkIn()
    const timer = setInterval(loadStatus, 60000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        loadStatus()
        checkIn()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [loadStatus, checkIn])

  useEffect(() => () => {
    clearTimeout(toastTimer.current)
    clearTimeout(activityTimer.current)
  }, [])

  const pets = status?.pets || []
  const pet = pets.find(p => p.id === selectedId) || pets[0] || null
  const inventory = status?.inventory || {}
  const tokens = status?.tokens || 0
  const maxPets = status?.max_pets || 5
  const baseMood = useMemo(() => petMood(pet), [pet])
  const dead = Boolean(pet?.died_at)
  const sick = Boolean(pet?.critical_since) && !dead
  const mood = dead ? 'dead' : (activity || baseMood)
  const petSpecies = species.find(s => s.id === pet?.species_id)
  const speciesName = petSpecies?.name
  const petTier = petSpecies?.tier || 1

  // The pet says hello the first time it's seen after opening the page
  useEffect(() => {
    if (petSpecies && !greeted.current && !readOnly) {
      greeted.current = true
      playSound('greet', petSpecies.kind)
    }
  }, [petSpecies])

  const toggleSound = () => {
    const next = !soundOff
    setMuted(next)
    setSoundOff(next)
    if (!next) playSound('tap')
  }

  const showToast = (text, kind = 'ok') => {
    setToast({ text, kind })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }

  const playFx = (emoji) => setFx({ emoji, key: Date.now() })

  // Always points at the latest render so loadStatus can celebrate a level-up
  useEffect(() => {
    onLevelUp.current = (p, from) => {
      let reward = 0
      for (let l = from + 1; l <= p.level; l++) reward += levelReward(l)
      showToast(`🎉 ${p.name} reached level ${p.level}! +${reward} Pet Tokens`)
      playSound('levelup')
      playFx('🎉')
      setLevelFlash({ id: p.id, key: Date.now() })
    }
  })

  useEffect(() => {
    onCheckedIn.current = (n) => {
      showToast(`🎁 Thanks for checking in! +${n} Pet Tokens`)
      playSound('sparkle')
    }
  })

  const startActivity = (kind) => {
    setActivity(kind)
    clearTimeout(activityTimer.current)
    activityTimer.current = setTimeout(() => setActivity(null), ACTIVITY_MS[kind] || 3000)
    // Keep the whole pet in view while it plays the animation
    const box = sceneRef.current?.getBoundingClientRect()
    if (box && (box.top < 0 || box.bottom > window.innerHeight)) {
      sceneRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  // Runs an action, reports the result, and refreshes. Returns true on success.
  const run = async (fn, { ok, emoji, sound, activity: kind } = {}) => {
    if (busy || readOnly) return false
    setBusy(true)
    const err = await fn()
    if (err) {
      showToast(err, 'error')
      playSound('error')
    } else {
      if (ok) showToast(ok)
      if (emoji) playFx(emoji)
      if (sound) playSound(sound)
      if (kind) startActivity(kind)
    }
    await loadStatus()
    setBusy(false)
    return !err
  }

  const selectPet = (id) => {
    setSelectedId(id)
    setPicker(null)
    setActivity(null)
    setRenaming(false)
  }

  const adopt = async (sp, name) => {
    let newId = null
    const done = await run(async () => {
      const { error, data } = await petApi.adopt(sp.id, name)
      newId = data
      return error
    }, { ok: `Welcome home, ${name.trim()}! 🎉`, emoji: '🎉', sound: 'adopt' })
    if (done) {
      if (newId) selectPet(newId)
      setAdding(false)
      setTab('home')
    }
    return done
  }

  const applyItem = async (item) => {
    const cat = CATEGORY[item.category]
    const done = await run(() => petApi.use(pet.id, item.id), {
      ok: cat.done(pet.name, item.name), emoji: cat.fx, sound: CARE_SOUND[item.category], activity: ACTIVITY_OF[item.category],
    })
    if (done && cat.consumable && (inventory[item.id] || 0) <= 1) setPicker(null)
  }

  const buy = (item) =>
    run(() => petApi.buy(item.id), {
      ok: CATEGORY[item.category].slot ? `Bought ${item.name}! Wear it from your Bag.` : `Bought ${item.name}!`,
      emoji: '🛍️',
      sound: 'buy',
    })

  const wear = (item) => run(() => petApi.equip(pet.id, item.id), { emoji: '✨', sound: 'sparkle' })
  const takeOff = (slot) => run(() => petApi.unequip(pet.id, slot), { sound: 'take' })
  const revive = () => run(() => petApi.revive(pet.id), { ok: `${pet.name} is back! Take good care of them. 💖`, emoji: '✨', sound: 'adopt' })
  const cuddle = () => run(() => petApi.cuddle(pet.id), { ok: `${pet.name} loves cuddles!`, emoji: '🥰', sound: 'purr', activity: 'cuddling' })

  const saveName = async () => {
    if (!nameDraft.trim()) return
    if (await run(() => petApi.rename(pet.id, nameDraft), { ok: 'New name saved!', sound: 'save' })) setRenaming(false)
  }

  if (loadError) {
    return (
      <div className="bg-white rounded-2xl border p-6 text-center text-sm text-gray-500">
        Pets are not available yet. ({loadError})
      </div>
    )
  }
  if (!status) {
    return <p className="text-center text-gray-400 py-10">Loading...</p>
  }
  if (readOnly && pets.length === 0) {
    return (
      <div className="bg-white rounded-2xl border p-6 text-center text-sm text-gray-500">
        {viewName || 'This child'} doesn&apos;t have a pet yet.
      </div>
    )
  }

  const cuddleWait = pet?.cuddle_ready_at
    ? Math.ceil((new Date(pet.cuddle_ready_at).getTime() - status.loadedAt) / 60000)
    : 0

  // Food and treats are made for one kind of pet; everything else suits any pet
  // Seasonal items only appear in the shop while their season is on (what's already owned stays in the bag)
  const seasonTabs = (status.seasons || []).filter(k => SEASONS[k]).map(k => ({ key: `season:${k}`, ...SEASONS[k] }))
  const shopItems = items.filter(i => (shopCat.startsWith('season:')
    ? i.season === shopCat.slice(7) && (status.seasons || []).includes(i.season)
    : i.category === shopCat && !i.season))
  const suitsPet = (item) => item.for_tier == null || item.for_tier === petTier
  const ownedIn = (catKey) => items.filter(i => i.category === catKey && (inventory[i.id] || 0) > 0 && suitsPet(i))
  // Which of your other pets is already wearing an item
  const wornBy = (itemId) => pets.find(p => p.id !== pet?.id && (p.collar === itemId || p.head === itemId || p.face === itemId))

  const showStore = (!pet || adding) && !readOnly

  return (
    <div className="space-y-5">
      {readOnly ? (
        <div className="bg-sun-100 text-sun-800 text-sm text-center py-2 px-4 rounded-xl">
          👀 You&apos;re looking at {viewName ? `${viewName}'s` : 'their'} pets. This is what they see, but you can&apos;t change anything.
        </div>
      ) : banner && (
        <div className="bg-sun-100 text-sun-800 text-sm text-center py-2 px-4 rounded-xl">{banner}</div>
      )}

      <PetTokens tokens={tokens} />

      {!readOnly && <div className="flex justify-end -mt-3">
        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={!soundOff}
          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
        >
          {soundOff ? '🔇 Sounds off' : '🔊 Sounds on'}
        </button>
      </div>}

      {toast && !(pet && !showStore && tab === 'home') && (
        <div
          role="status"
          className={`rounded-xl px-4 py-3 text-sm font-medium text-center ${
            toast.kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-sage-100 text-sage-800'
          }`}
        >
          {toast.text}
        </div>
      )}

      {showStore ? (
        <PetStore
          species={species}
          tokens={tokens}
          onAdopt={adopt}
          busy={busy}
          onCancel={pet ? () => setAdding(false) : null}
        />
      ) : (
        <>
          <PetSwitcher
            pets={pets}
            selectedId={pet.id}
            onSelect={selectPet}
            canAdd={pets.length < maxPets && !readOnly}
            onAdd={() => setAdding(true)}
          />

          <div className="flex bg-white rounded-2xl border overflow-hidden">
            {[
              { key: 'home', label: 'Home', icon: '🏠' },
              { key: 'shop', label: 'Shop', icon: '🛍️' },
              { key: 'bag', label: 'Bag', icon: '🎒' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  tab === t.key ? 'bg-sage-50 text-forest-800 border-b-2 border-sun-500' : 'text-gray-500'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {tab === 'home' && (
            <div className="space-y-4">
              <div ref={sceneRef} className="rounded-3xl border bg-gradient-to-b from-sage-100 to-tan-50 p-4 flex flex-col items-center relative overflow-hidden scroll-mt-4">
                <LevelHeader pet={pet} flashKey={levelFlash.id === pet.id ? levelFlash.key : 0} />
                <div className="relative w-full flex justify-center">
                  {toast && (
                    <div
                      role="status"
                      className={`absolute top-0 inset-x-0 z-10 rounded-xl px-3 py-1.5 text-xs font-medium text-center shadow-sm ${
                        toast.kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-white/90 text-sage-800'
                      }`}
                    >
                      {toast.text}
                    </div>
                  )}
                  <div className="relative">
                    <PetSprite
                      species={pet.species_id}
                      mood={mood}
                      collar={pet.collar}
                      head={pet.head}
                      face={pet.face}
                      level={pet.level}
                      size={230}
                      className={dead ? '' : (ACTIVITY_CLASS[activity] || 'pet-bob')}
                    />
                    {fx && (
                      <span key={fx.key} className="pet-pop absolute left-1/2 top-8 -translate-x-1/2 text-4xl pointer-events-none">
                        {fx.emoji}
                      </span>
                    )}
                  </div>
                </div>

                {renaming ? (
                  <div className="flex gap-2 mt-1 w-full max-w-xs">
                    <input
                      autoFocus
                      value={nameDraft}
                      maxLength={20}
                      onChange={e => setNameDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveName() }}
                      className="flex-1 min-w-0 px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sun-500"
                    />
                    <button onClick={saveName} disabled={busy || !nameDraft.trim()} className="px-3 py-2 bg-sage-600 text-white rounded-xl text-sm font-semibold disabled:opacity-40">Save</button>
                    <button onClick={() => setRenaming(false)} className="px-3 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm">Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setNameDraft(pet.name); setRenaming(true) }}
                    disabled={readOnly}
                    className="text-xl font-bold text-forest-800 flex items-center gap-2"
                    title="Change name"
                  >
                    {pet.name} {!readOnly && <span className="text-sm text-gray-400">✏️</span>}
                  </button>
                )}
                <p className="text-xs text-gray-500">{speciesName}</p>
                <p className="mt-1 text-sm font-medium text-forest-800">{(ACTIVITY_TEXT[activity] || MOOD_TEXT[mood] || MOOD_TEXT.content)(pet.name)}</p>
              </div>

              {sick && <SickBanner pet={pet} now={status.loadedAt} />}
              {dead && <ReviveBox pet={pet} tokens={tokens} busy={busy || readOnly} onRevive={revive} />}

              {!dead && <div className="grid grid-cols-3 gap-2">
                {CARE_ACTIONS.map(key => {
                  const cat = CATEGORY[key]
                  const have = ownedIn(key).reduce((n, i) => n + (cat.consumable ? inventory[i.id] : 1), 0)
                  return (
                    <button
                      key={key}
                      onClick={() => setPicker(picker === key ? null : key)}
                      disabled={readOnly}
                      className={`relative bg-white border rounded-2xl py-3 flex flex-col items-center active:scale-95 transition-all disabled:opacity-60 ${
                        picker === key ? 'border-sun-500 ring-2 ring-sun-200' : ''
                      }`}
                    >
                      <span className="text-2xl">{cat.icon}</span>
                      <span className="text-xs font-semibold text-gray-700 mt-1">{cat.verb}</span>
                      {have > 0 && (
                        <span className="absolute top-1.5 right-2 text-[10px] bg-sage-100 text-sage-700 rounded-full px-1.5">{have}</span>
                      )}
                    </button>
                  )
                })}
                <button
                  onClick={cuddle}
                  disabled={busy || readOnly || cuddleWait > 0}
                  className="bg-white border rounded-2xl py-3 flex flex-col items-center active:scale-95 transition-all disabled:opacity-50"
                >
                  <span className="text-2xl">🤗</span>
                  <span className="text-xs font-semibold text-gray-700 mt-1">
                    {cuddleWait > 0 ? `${cuddleWait} min` : 'Cuddle'}
                  </span>
                </button>
              </div>}

              {picker && !dead && (
                <div className="bg-white rounded-2xl border p-3 space-y-2">
                  <p className="text-sm font-semibold text-gray-700">
                    {CATEGORY[picker].icon} {CATEGORY[picker].verb} {pet.name}
                  </p>
                  {ownedIn(picker).map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-2 rounded-xl bg-gray-50">
                      <span className="text-2xl">{item.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                        <p className="text-xs text-gray-500">
                          {describeEffects(item)}
                          {CATEGORY[picker].consumable && ` · you have ${inventory[item.id]}`}
                        </p>
                      </div>
                      <button
                        onClick={() => applyItem(item)}
                        disabled={busy}
                        className="px-4 py-1.5 bg-sage-600 text-white rounded-full text-sm font-semibold disabled:opacity-50"
                      >
                        {CATEGORY[picker].verb}
                      </button>
                    </div>
                  ))}
                  {ownedIn(picker).length === 0 && (
                    <div className="text-center py-2">
                      <p className="text-sm text-gray-500">
                        You don&apos;t have any {CATEGORY[picker].label.toLowerCase()} for {pet.name} yet.
                      </p>
                      <button
                        onClick={() => { setShopCat(picker); setTab('shop') }}
                        className="mt-2 px-4 py-1.5 bg-sun-500 text-white rounded-full text-sm font-semibold"
                      >
                        Go to the shop
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-white rounded-2xl border p-4 space-y-3">
                <StatBar icon="🍗" label="Food" value={pet.fullness} />
                <StatBar icon="💖" label="Love" value={pet.love} />
                <StatBar icon="🫧" label="Clean" value={pet.clean} />
                <StatBar icon="💤" label="Rest" value={pet.rest} />
                <div className="pt-2 border-t">
                  <CareStreak pet={pet} now={status.loadedAt} />
                </div>
                <CheckinNote status={status} />
              </div>

              {testMode && <TestControls key={pet.id} pet={pet} onChanged={loadStatus} />}
            </div>
          )}

          {tab === 'shop' && (
            <div className="space-y-3">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {seasonTabs.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setShopCat(t.key)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border ${
                      shopCat === t.key ? 'bg-red-600 text-white border-red-600' : 'bg-red-50 text-red-700 border-red-200'
                    }`}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
                {CATEGORIES.map(c => (
                  <button
                    key={c.key}
                    onClick={() => setShopCat(c.key)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border ${
                      shopCat === c.key ? 'bg-forest-800 text-white border-forest-800' : 'bg-white text-gray-600'
                    }`}
                  >
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>

              {shopCat.startsWith('season:') && (
                <p className="text-xs text-red-700 bg-red-50 rounded-xl px-3 py-2">
                  {SEASONS[shopCat.slice(7)]?.note}
                </p>
              )}
              {shopItems.sort((a, b) => a.cost - b.cost).map(item => {
                const cat = CATEGORY[item.category]
                const have = inventory[item.id] || 0
                const owned = !cat.consumable && have > 0
                return (
                  <div key={item.id} className="bg-white p-3 rounded-2xl border flex items-center gap-3">
                    {cat.slot ? (
                      <PetSprite
                        species={pet.species_id}
                        mood="happy"
                        level={pet.level}
                        collar={item.category === 'collar' ? item.id : null}
                        head={item.category === 'head' ? item.id : null}
                        face={item.category === 'face' ? item.id : null}
                        size={64}
                      />
                    ) : (
                      <span className="text-4xl w-16 text-center">{item.emoji}</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-gray-800 text-sm">{item.name}</h4>
                        <TierBadge tier={item.tier} />
                      </div>
                      {item.for_tier && <p className="text-[11px] text-gray-400 mt-0.5">For {TIER_NOTE[item.for_tier]}</p>}
                      {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                      {describeEffects(item) && <p className="text-xs text-sage-700 mt-0.5">{describeEffects(item)}</p>}
                      {cat.consumable && have > 0 && <p className="text-xs text-gray-400">You have {have}</p>}
                    </div>
                    {owned ? (
                      <span className="px-3 py-1.5 bg-gray-100 text-gray-400 rounded-full text-xs font-semibold shrink-0">Owned ✓</span>
                    ) : (
                      <button
                        onClick={() => buy(item)}
                        disabled={busy || readOnly || tokens < item.cost}
                        className="px-3 py-1.5 bg-sun-500 text-white rounded-full text-sm font-semibold shrink-0 disabled:opacity-40"
                      >
                        🐾 {item.cost}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {tab === 'bag' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center">
                <PetSprite
                  species={pet.species_id}
                  mood="happy"
                  collar={pet.collar}
                  head={pet.head}
                  face={pet.face}
                  level={pet.level}
                  size={150}
                  className="pet-bob"
                />
                <p className="text-sm font-semibold text-forest-800">{pet.name}</p>
              </div>

              {WEARABLE.map(cat => {
                const owned = ownedIn(cat.key)
                const wearing = pet[cat.slot]
                return (
                  <div key={cat.key} className="bg-white rounded-2xl border p-3">
                    <p className="text-sm font-semibold text-gray-700 mb-2">{cat.icon} {cat.label}</p>
                    {owned.length === 0 ? (
                      <p className="text-xs text-gray-400">
                        Nothing yet.{' '}
                        <button onClick={() => { setShopCat(cat.key); setTab('shop') }} className="underline text-sage-700">
                          Visit the shop
                        </button>
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => takeOff(cat.slot)}
                          disabled={busy || readOnly || !wearing}
                          className={`px-3 py-1.5 rounded-full text-sm border ${!wearing ? 'bg-forest-800 text-white border-forest-800' : 'bg-white text-gray-600'}`}
                        >
                          None
                        </button>
                        {owned.map(item => {
                          const other = wornBy(item.id)
                          return (
                            <button
                              key={item.id}
                              onClick={() => wear(item)}
                              disabled={busy || readOnly || wearing === item.id}
                              className={`px-3 py-1.5 rounded-full text-sm border ${wearing === item.id ? 'bg-forest-800 text-white border-forest-800' : 'bg-white text-gray-700'}`}
                            >
                              {item.emoji} {item.name}{other ? ` (on ${other.name})` : ''}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}

              <div className="bg-white rounded-2xl border p-3">
                <p className="text-sm font-semibold text-gray-700 mb-2">🎒 Supplies &amp; toys (shared by all your pets)</p>
                {items.filter(i => !CATEGORY[i.category].slot && (inventory[i.id] || 0) > 0).length === 0 ? (
                  <p className="text-xs text-gray-400">Your bag is empty. Visit the shop!</p>
                ) : (
                  <div className="space-y-1">
                    {items.filter(i => !CATEGORY[i.category].slot && (inventory[i.id] || 0) > 0).map(i => (
                      <div key={i.id} className="flex items-center gap-2 text-sm text-gray-700">
                        <span className="text-xl">{i.emoji}</span>
                        <span className="flex-1">{i.name}</span>
                        {CATEGORY[i.category].consumable && <span className="text-gray-400">×{inventory[i.id]}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
