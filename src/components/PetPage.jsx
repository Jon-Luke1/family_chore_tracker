import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { petMood } from '../lib/petArt'
import { CATEGORIES, CATEGORY, WEARABLE, TIERS, MOOD_TEXT, describeEffects, petApi } from '../lib/pets'
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
      <p className="text-xs text-sage-300 text-right max-w-[9rem]">
        You earn 1 Pet Token for every token you earn!
      </p>
    </div>
  )
}

// Shown before a pet is adopted: pick a breed, then name it
function PetStore({ species, tokens, onAdopt, busy }) {
  const [chosen, setChosen] = useState(null)
  const [name, setName] = useState('')

  const cost = chosen?.cost ?? 25
  const canAfford = tokens >= cost

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-800">🐾 Pet Store</h3>
        <p className="text-sm text-gray-500">Pick a pet to adopt. Every pet costs {species[0]?.cost ?? 25} Pet Tokens.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {species.map(sp => (
          <button
            key={sp.id}
            onClick={() => { setChosen(sp); setName('') }}
            className="bg-white rounded-2xl border shadow-sm p-3 flex flex-col items-center hover:border-sun-500 active:scale-95 transition-all"
          >
            <PetSprite species={sp.id} mood="happy" size={110} />
            <span className="font-semibold text-gray-800 mt-1 text-sm">{sp.name}</span>
            <span className="text-xs text-gray-400">{sp.kind === 'dog' ? '🐶 Dog' : '🐱 Cat'}</span>
            <span className="mt-2 text-xs px-2.5 py-1 rounded-full bg-sun-100 text-sun-700 font-semibold">🐾 {sp.cost}</span>
          </button>
        ))}
      </div>

      {chosen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={() => setChosen(null)}>
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center">
              <PetSprite species={chosen.id} mood="happy" size={170} className="pet-bob" />
              <h4 className="font-bold text-forest-800 text-lg">{chosen.name}</h4>
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

// `banner` is an optional note shown on top (used by parent test mode)
// Parent test mode only: drag the sliders to set a pet's stats and watch how it reacts
const TEST_STATS = [
  { key: 'fullness', icon: '🍗', label: 'Food', param: 'p_fullness' },
  { key: 'love', icon: '💖', label: 'Love', param: 'p_love' },
  { key: 'clean', icon: '🫧', label: 'Clean', param: 'p_clean' },
  { key: 'rest', icon: '💤', label: 'Rest', param: 'p_rest' },
]

function TestControls({ pet, onChanged }) {
  const [draft, setDraft] = useState({})
  const [error, setError] = useState('')
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  // Wait for the slider to settle, then save and refresh
  const commit = (vals) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const args = Object.fromEntries(TEST_STATS.map(s => [s.param, vals[s.key] ?? null]))
      const { error: rpcError } = await supabase.rpc('pet_test_set_stats', args)
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
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-xs text-gray-500">Changes save as you drag. Stats drift down from there as normal.</p>
    </div>
  )
}

export default function PetPage({ onTokensChange, banner, testMode = false }) {
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
  const toastTimer = useRef(null)
  const greeted = useRef(false)
  const [activity, setActivity] = useState(null)
  const activityTimer = useRef(null)
  const sceneRef = useRef(null)

  const loadStatus = useCallback(async () => {
    const { data, error } = await petApi.status()
    if (error) {
      setLoadError(error.message)
      return
    }
    setLoadError('')
    setStatus({ ...data, loadedAt: Date.now() })
    if (onTokensChange) onTokensChange(data.tokens)
  }, [onTokensChange])

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
  useEffect(() => {
    loadStatus()
    const timer = setInterval(loadStatus, 60000)
    const onVisible = () => { if (document.visibilityState === 'visible') loadStatus() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [loadStatus])

  useEffect(() => () => {
    clearTimeout(toastTimer.current)
    clearTimeout(activityTimer.current)
  }, [])

  const pet = status?.pet || null
  const inventory = status?.inventory || {}
  const tokens = status?.tokens || 0
  const baseMood = useMemo(() => petMood(pet), [pet])
  const mood = activity || baseMood
  const petSpecies = species.find(s => s.id === pet?.species_id)
  const speciesName = petSpecies?.name

  // The pet says hello the first time it's seen after opening the page
  useEffect(() => {
    if (petSpecies && !greeted.current) {
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

  // Runs an action, reports the result, and refreshes. Returns true on success.
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

  const run = async (fn, { ok, emoji, sound, activity: kind } = {}) => {
    if (busy) return false
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

  const adopt = (sp, name) =>
    run(() => petApi.adopt(sp.id, name), { ok: `Welcome home, ${name.trim()}! 🎉`, emoji: '🎉', sound: 'adopt' })

  const applyItem = async (item) => {
    const cat = CATEGORY[item.category]
    const done = await run(() => petApi.use(item.id), { ok: cat.done(pet.name, item.name), emoji: cat.fx, sound: CARE_SOUND[item.category], activity: ACTIVITY_OF[item.category] })
    if (done && cat.consumable && (inventory[item.id] || 0) <= 1) setPicker(null)
  }

  const buy = (item) =>
    run(() => petApi.buy(item.id), {
      ok: CATEGORY[item.category].slot ? `Bought ${item.name}! Wear it from your Bag.` : `Bought ${item.name}!`,
      emoji: '🛍️',
      sound: 'buy',
    })

  const wear = (item) => run(() => petApi.equip(item.id), { emoji: '✨', sound: 'sparkle' })
  const takeOff = (slot) => run(() => petApi.unequip(slot), { sound: 'take' })
  const cuddle = () => run(() => petApi.cuddle(), { ok: `${pet.name} loves cuddles!`, emoji: '🥰', sound: 'purr', activity: 'cuddling' })

  const saveName = async () => {
    if (!nameDraft.trim()) return
    if (await run(() => petApi.rename(nameDraft), { ok: 'New name saved!', sound: 'save' })) setRenaming(false)
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

  const cuddleWait = pet?.cuddle_ready_at
    ? Math.ceil((new Date(pet.cuddle_ready_at).getTime() - status.loadedAt) / 60000)
    : 0

  const ownedIn = (catKey) => items.filter(i => i.category === catKey && (inventory[i.id] || 0) > 0)

  return (
    <div className="space-y-5">
      {banner && (
        <div className="bg-sun-100 text-sun-800 text-sm text-center py-2 px-4 rounded-xl">{banner}</div>
      )}

      <PetTokens tokens={tokens} />

      <div className="flex justify-end -mt-3">
        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={!soundOff}
          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
        >
          {soundOff ? '🔇 Sounds off' : '🔊 Sounds on'}
        </button>
      </div>

      {toast && !(pet && tab === 'home') && (
        <div
          role="status"
          className={`rounded-xl px-4 py-3 text-sm font-medium text-center ${
            toast.kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-sage-100 text-sage-800'
          }`}
        >
          {toast.text}
        </div>
      )}

      {!pet ? (
        <PetStore species={species} tokens={tokens} onAdopt={adopt} busy={busy} />
      ) : (
        <>
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
                {toast && (
                  <div
                    role="status"
                    className={`absolute top-2 inset-x-3 z-10 rounded-xl px-3 py-1.5 text-xs font-medium text-center shadow-sm ${
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
                    size={230}
                    className={ACTIVITY_CLASS[activity] || 'pet-bob'}
                  />
                  {fx && (
                    <span key={fx.key} className="pet-pop absolute left-1/2 top-8 -translate-x-1/2 text-4xl pointer-events-none">
                      {fx.emoji}
                    </span>
                  )}
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
                    className="text-xl font-bold text-forest-800 flex items-center gap-2"
                    title="Change name"
                  >
                    {pet.name} <span className="text-sm text-gray-400">✏️</span>
                  </button>
                )}
                <p className="text-xs text-gray-500">{speciesName}</p>
                <p className="mt-1 text-sm font-medium text-forest-800">{(ACTIVITY_TEXT[activity] || MOOD_TEXT[mood] || MOOD_TEXT.content)(pet.name)}</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {CARE_ACTIONS.map(key => {
                  const cat = CATEGORY[key]
                  const have = ownedIn(key).reduce((n, i) => n + (cat.consumable ? inventory[i.id] : 1), 0)
                  return (
                    <button
                      key={key}
                      onClick={() => setPicker(picker === key ? null : key)}
                      className={`relative bg-white border rounded-2xl py-3 flex flex-col items-center active:scale-95 transition-all ${
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
                  disabled={busy || cuddleWait > 0}
                  className="bg-white border rounded-2xl py-3 flex flex-col items-center active:scale-95 transition-all disabled:opacity-50"
                >
                  <span className="text-2xl">🤗</span>
                  <span className="text-xs font-semibold text-gray-700 mt-1">
                    {cuddleWait > 0 ? `${cuddleWait} min` : 'Cuddle'}
                  </span>
                </button>
              </div>

              {picker && (
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
                      <p className="text-sm text-gray-500">You don&apos;t have any {CATEGORY[picker].label.toLowerCase()} yet.</p>
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
              </div>

              {testMode && <TestControls pet={pet} onChanged={loadStatus} />}
            </div>
          )}

          {tab === 'shop' && (
            <div className="space-y-3">
              <div className="flex gap-2 overflow-x-auto pb-1">
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

              {items.filter(i => i.category === shopCat).sort((a, b) => a.cost - b.cost).map(item => {
                const cat = CATEGORY[item.category]
                const have = inventory[item.id] || 0
                const owned = !cat.consumable && have > 0
                return (
                  <div key={item.id} className="bg-white p-3 rounded-2xl border flex items-center gap-3">
                    {cat.slot ? (
                      <PetSprite
                        species={pet.species_id}
                        mood="happy"
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
                      {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                      {describeEffects(item) && <p className="text-xs text-sage-700 mt-0.5">{describeEffects(item)}</p>}
                      {cat.consumable && have > 0 && <p className="text-xs text-gray-400">You have {have}</p>}
                    </div>
                    {owned ? (
                      <span className="px-3 py-1.5 bg-gray-100 text-gray-400 rounded-full text-xs font-semibold shrink-0">Owned ✓</span>
                    ) : (
                      <button
                        onClick={() => buy(item)}
                        disabled={busy || tokens < item.cost}
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
              <div className="flex justify-center">
                <PetSprite
                  species={pet.species_id}
                  mood="happy"
                  collar={pet.collar}
                  head={pet.head}
                  face={pet.face}
                  size={150}
                  className="pet-bob"
                />
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
                          disabled={busy || !wearing}
                          className={`px-3 py-1.5 rounded-full text-sm border ${!wearing ? 'bg-forest-800 text-white border-forest-800' : 'bg-white text-gray-600'}`}
                        >
                          None
                        </button>
                        {owned.map(item => (
                          <button
                            key={item.id}
                            onClick={() => wear(item)}
                            disabled={busy || wearing === item.id}
                            className={`px-3 py-1.5 rounded-full text-sm border ${wearing === item.id ? 'bg-forest-800 text-white border-forest-800' : 'bg-white text-gray-700'}`}
                          >
                            {item.emoji} {item.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

              <div className="bg-white rounded-2xl border p-3">
                <p className="text-sm font-semibold text-gray-700 mb-2">🎒 Supplies &amp; toys</p>
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
