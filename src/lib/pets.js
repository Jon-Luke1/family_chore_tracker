import { supabase } from './supabase'

// Shop sections, in display order. `consumable` items get used up; the rest are kept.
export const CATEGORIES = [
  { key: 'food', label: 'Food', icon: '🍗', consumable: true, verb: 'Feed', fx: '😋', done: (n, i) => `${n} gobbled up the ${i}!` },
  { key: 'treat', label: 'Treats', icon: '🦴', consumable: true, verb: 'Treat', fx: '💖', done: (n, i) => `${n} loved the ${i}!` },
  { key: 'toy', label: 'Toys', icon: '🎾', consumable: false, verb: 'Play', fx: '🎉', done: (n, i) => `${n} had a blast with the ${i}!` },
  { key: 'groom', label: 'Grooming', icon: '🛁', consumable: true, verb: 'Bathe', fx: '🫧', done: (n, i) => `${n} is fresh and clean from the ${i}!` },
  { key: 'bed', label: 'Beds', icon: '🛏️', consumable: false, verb: 'Nap', fx: '💤', done: (n, i) => `${n} had a lovely nap on the ${i}.` },
  { key: 'collar', label: 'Collars', icon: '🔔', consumable: false, slot: 'collar' },
  { key: 'head', label: 'Hats', icon: '🎩', consumable: false, slot: 'head' },
  { key: 'face', label: 'Glasses', icon: '🕶️', consumable: false, slot: 'face' },
]

export const CATEGORY = Object.fromEntries(CATEGORIES.map(c => [c.key, c]))
export const WEARABLE = CATEGORIES.filter(c => c.slot)

export const TIERS = {
  1: { label: 'Basic', badge: 'bg-gray-100 text-gray-600' },
  2: { label: 'Nice', badge: 'bg-sage-100 text-sage-700' },
  3: { label: 'Fancy', badge: 'bg-sun-100 text-sun-700' },
  4: { label: 'Deluxe', badge: 'bg-purple-100 text-purple-700' },
}

// Seasonal shop tabs. The dates are decided in the database (_active_seasons in supabase/pets.sql).
export const SEASONS = {
  christmas: { label: 'Christmas', icon: '🎄', note: '🎅 Holiday items are only for sale until January 6!' },
}

export const MAX_LEVEL = 30

// Pet Tokens paid when a pet reaches a level. Keep in sync with _level_reward in supabase/pets.sql.
export const levelReward = (level) => 3 + Math.floor(level / 2) + (level % 5 === 0 ? 5 : 0)

export const KIND_LABEL = {
  dog: '🐶 Dog', cat: '🐱 Cat', bird: '🐦 Bird', lizard: '🦎 Lizard', frog: '🐸 Frog',
  turtle: '🐢 Turtle', hedgehog: '🦔 Hedgehog', axolotl: '🌸 Axolotl',
}

// The store groups pets by tier
export const SPECIES_TIERS = {
  1: { title: 'Classic pets', note: 'Dogs and cats' },
  2: { title: 'Exotic pets', note: 'Birds, reptiles and more. They cost extra!' },
}

export const MOOD_TEXT = {
  happy: (n) => `${n} is happy! 🥰`,
  content: (n) => `${n} is doing okay.`,
  hungry: (n) => `${n} is hungry!`,
  dirty: (n) => `${n} needs a bath!`,
  sleepy: (n) => `${n} is sleepy.`,
  sad: (n) => `${n} needs some love.`,
  sick: (n) => `${n} is very sick! 🤒`,
  dead: (n) => `${n} has passed away. 💔`,
}

// "1 day 5 hours" / "3 hours" / "20 minutes" for a span of milliseconds
export function formatSpan(ms) {
  const mins = Math.max(0, Math.floor(ms / 60000))
  const days = Math.floor(mins / 1440)
  const hours = Math.floor((mins % 1440) / 60)
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
  if (days > 0) return hours > 0 ? `${plural(days, 'day')} ${plural(hours, 'hour')}` : plural(days, 'day')
  if (hours > 0) return plural(hours, 'hour')
  return plural(Math.max(1, mins), 'minute')
}

// "+40 food · +10 love" for an item
export function describeEffects(item) {
  const parts = []
  if (item.fullness) parts.push(`+${item.fullness} food`)
  if (item.love) parts.push(`+${item.love} love`)
  if (item.clean) parts.push(`+${item.clean} clean`)
  if (item.rest) parts.push(`+${item.rest} rest`)
  return parts.join(' · ')
}

// Each helper resolves to an error message, or null on success
const call = async (fn, args) => {
  const { error } = await supabase.rpc(fn, args)
  return error ? error.message : null
}

export const petApi = {
  status: () => supabase.rpc('pet_status'),
  // Resolves to { data: { awarded, ready_at } }; pays 5 Pet Tokens at most once an hour
  checkin: () => supabase.rpc('pet_checkin'),
  // Resolves to { error, data: the new pet's id }
  adopt: async (speciesId, name) => {
    const { data, error } = await supabase.rpc('adopt_pet', { p_species_id: speciesId, p_name: name })
    return { error: error ? error.message : null, data }
  },
  rename: (petId, name) => call('rename_pet', { p_pet_id: petId, p_name: name }),
  buy: (itemId) => call('buy_pet_item', { p_item_id: itemId }),
  use: (petId, itemId) => call('use_pet_item', { p_pet_id: petId, p_item_id: itemId }),
  cuddle: (petId) => call('pet_cuddle', { p_pet_id: petId }),
  equip: (petId, itemId) => call('equip_pet_item', { p_pet_id: petId, p_item_id: itemId }),
  revive: (petId) => call('revive_pet', { p_pet_id: petId }),
  unequip: (petId, slot) => call('unequip_pet_slot', { p_pet_id: petId, p_slot: slot }),
}
