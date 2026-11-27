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

export const MOOD_TEXT = {
  happy: (n) => `${n} is happy! 🥰`,
  content: (n) => `${n} is doing okay.`,
  hungry: (n) => `${n} is hungry!`,
  dirty: (n) => `${n} needs a bath!`,
  sleepy: (n) => `${n} is sleepy.`,
  sad: (n) => `${n} needs some love.`,
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
  adopt: (speciesId, name) => call('adopt_pet', { p_species_id: speciesId, p_name: name }),
  rename: (name) => call('rename_pet', { p_name: name }),
  buy: (itemId) => call('buy_pet_item', { p_item_id: itemId }),
  use: (itemId) => call('use_pet_item', { p_item_id: itemId }),
  cuddle: () => call('pet_cuddle'),
  equip: (itemId) => call('equip_pet_item', { p_item_id: itemId }),
  unequip: (slot) => call('unequip_pet_slot', { p_slot: slot }),
}
