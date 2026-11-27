// Cartoon pets drawn as inline SVG (no image files needed).
// petSvg() returns an SVG string built only from the fixed palettes below, so it is
// safe to inject with dangerouslySetInnerHTML. Moods: happy, content, hungry, dirty,
// sleepy, sad. Accessories are looked up by shop item id (see supabase/pets.sql).

import { EXOTIC_ART, exoticLayers } from './petArtExotic.js'

const OUT = '#3b2f2f' // outline colour
const DARK_EYE = '#1f1a1a'

// Colours and features for each breed. `ear` is 'floppy' | 'pointy' | 'cat'.
export const SPECIES_ART = {
  'golden-retriever': {
    kind: 'dog', base: '#eab14e', light: '#f9e0a4', paw: '#eab14e', ear: 'floppy', earColor: '#cf8f2e',
    nose: '#3b2a20', pattern: 'none',
  },
  dalmatian: {
    kind: 'dog', base: '#fbfbf7', light: '#ffffff', paw: '#fbfbf7', ear: 'floppy', earColor: '#2d2b2b',
    nose: '#2d2b2b', pattern: 'spots', mark: '#2d2b2b',
  },
  husky: {
    kind: 'dog', base: '#7d8a99', light: '#ffffff', paw: '#ffffff', ear: 'pointy', earColor: '#7d8a99',
    earInner: '#f4c9d0', nose: '#2b2b33', pattern: 'mask', iris: '#69c1ee',
  },
  corgi: {
    kind: 'dog', base: '#ec8f3c', light: '#ffffff', paw: '#ffffff', ear: 'pointy', earColor: '#ec8f3c',
    earInner: '#f9c9a0', nose: '#2b2b33', pattern: 'blaze', bigEars: true,
  },
  'chocolate-lab': {
    kind: 'dog', base: '#8a5632', light: '#b98558', paw: '#8a5632', ear: 'floppy', earColor: '#6b3f22',
    nose: '#241711', pattern: 'none',
  },
  'orange-tabby': {
    kind: 'cat', base: '#f2973c', light: '#fcdcaa', paw: '#fcdcaa', ear: 'cat', earColor: '#f2973c',
    earInner: '#f9b4b4', nose: '#e8808f', pattern: 'stripes', mark: '#cf6f1f', whisker: '#7a5a46',
  },
  'black-cat': {
    kind: 'cat', base: '#3a3943', light: '#5a5966', paw: '#3a3943', ear: 'cat', earColor: '#3a3943',
    earInner: '#d98aa0', nose: '#e8808f', pattern: 'none', iris: '#f4d03f', whisker: '#c9c9d6',
  },
  siamese: {
    kind: 'cat', base: '#f5e7d0', light: '#fff6e6', paw: '#6e4e3c', ear: 'cat', earColor: '#6e4e3c',
    earInner: '#b9808c', nose: '#8a5560', pattern: 'points', mark: '#6e4e3c', iris: '#5fb4e6', whisker: '#6e4e3c',
  },
  calico: {
    kind: 'cat', base: '#ffffff', light: '#ffffff', paw: '#ffffff', ear: 'cat', earColor: '#f08a2e',
    earColor2: '#35343c', earInner: '#f9b4b4', nose: '#e8808f', pattern: 'patches', whisker: '#7a6a62',
  },
  'white-persian': {
    kind: 'cat', base: '#fdfcfa', light: '#fff0f2', paw: '#fdfcfa', ear: 'cat', earColor: '#fdfcfa',
    earInner: '#f7bfc9', nose: '#f08fa0', pattern: 'none', iris: '#62b7cf', whisker: '#9a8f8a',
  },
}

Object.assign(SPECIES_ART, EXOTIC_ART)

let seq = 0

// The animation class goes on a wrapper so it doesn't clash with the path's own transform
const heart = (x, y, s, color, cls = '') =>
  `<g class="${cls}"><path transform="translate(${x} ${y}) scale(${s})" d="M0 5 C-11 -4 -6 -13 0 -6 C6 -13 11 -4 0 5Z" fill="${color}" stroke="#fff" stroke-width="1.2"/></g>`

// --- Pieces --------------------------------------------------------------

function tail(a) {
  const d = a.kind === 'dog'
    ? 'M146 158 Q186 152 176 112'
    : 'M146 166 Q184 172 176 128 Q172 108 184 100'
  const color = a.pattern === 'points' ? a.mark : a.pattern === 'patches' ? '#f08a2e' : a.base
  let s = `<g class="pet-tail"><path d="${d}" fill="none" stroke="${OUT}" stroke-width="21" stroke-linecap="round"/>`
  s += `<path d="${d}" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round"/>`
  if (a.pattern === 'stripes') {
    s += `<path d="${d}" fill="none" stroke="${a.mark}" stroke-width="14" stroke-dasharray="5 10" stroke-dashoffset="4"/>`
  }
  if (a.pattern === 'mask') {
    s += `<path d="${d}" fill="none" stroke="#ffffff" stroke-width="14" stroke-linecap="round" stroke-dasharray="0 70 20"/>`
  }
  return s + '</g>'
}

function body(a, id) {
  let s = `<clipPath id="bc${id}"><ellipse cx="100" cy="152" rx="50" ry="38"/></clipPath>`
  s += `<ellipse cx="100" cy="152" rx="50" ry="38" fill="${a.base}" stroke="${OUT}" stroke-width="3"/>`
  s += `<g clip-path="url(#bc${id})">`
  s += `<ellipse cx="100" cy="168" rx="29" ry="26" fill="${a.light}"/>`
  if (a.pattern === 'spots') {
    for (const [x, y, r] of [[66, 130, 7], [132, 124, 6], [78, 158, 5], [140, 156, 8], [112, 176, 5], [58, 170, 6]]) {
      s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${a.mark}"/>`
    }
  } else if (a.pattern === 'stripes') {
    for (const d of ['M52 132 Q64 140 60 158', 'M148 132 Q136 140 140 158', 'M60 116 Q74 124 70 138', 'M140 116 Q126 124 130 138']) {
      s += `<path d="${d}" fill="none" stroke="${a.mark}" stroke-width="5" stroke-linecap="round"/>`
    }
  } else if (a.pattern === 'patches') {
    s += `<path d="M50 140 Q58 110 94 118 Q88 152 70 164 Z" fill="#f08a2e"/>`
    s += `<path d="M116 124 Q154 114 154 152 Q140 168 122 152 Z" fill="#35343c"/>`
  } else if (a.pattern === 'points') {
    s += `<ellipse cx="100" cy="170" rx="50" ry="22" fill="#efd9b8" opacity="0.7"/>`
  }
  s += '</g>'
  // Front paws
  for (const x of [76, 124]) {
    s += `<ellipse cx="${x}" cy="186" rx="15" ry="9" fill="${a.paw}" stroke="${OUT}" stroke-width="3"/>`
    s += `<path d="M${x - 5} 188 v-4 M${x} 189 v-5 M${x + 5} 188 v-4" stroke="${OUT}" stroke-width="1.8" stroke-linecap="round" opacity="0.5"/>`
  }
  return s
}

function earShape(a, which) {
  // Draws the left ear (the right is mirrored by the caller)
  const color = which === 2 && a.earColor2 ? a.earColor2 : a.earColor
  const inner = a.earInner || color
  if (a.ear === 'floppy') {
    return `<ellipse cx="44" cy="98" rx="16" ry="31" transform="rotate(10 44 98)" fill="${color}" stroke="${OUT}" stroke-width="3"/>`
  }
  if (a.ear === 'pointy') {
    const big = a.bigEars
    const outer = big ? 'M50 78 Q34 26 46 10 Q82 20 96 54 Z' : 'M52 76 Q44 32 54 20 Q80 28 94 54 Z'
    const innerP = big ? 'M55 66 Q47 34 53 24 Q72 32 84 54 Z' : 'M57 66 Q53 40 58 32 Q74 38 84 54 Z'
    return `<path d="${outer}" fill="${color}" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="${innerP}" fill="${inner}"/>`
  }
  // cat
  return `<path d="M54 74 L50 22 L94 52 Z" fill="${color}" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>` +
    `<path d="M58 66 L56 34 L82 52 Z" fill="${inner}"/>`
}

const mirror = (inner) => `<g transform="translate(200 0) scale(-1 1)">${inner}</g>`

function headPattern(a, id) {
  let s = ''
  if (a.pattern === 'spots') {
    for (const [x, y, r] of [[68, 68, 7], [134, 70, 5], [58, 100, 4], [142, 104, 5]]) {
      s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${a.mark}"/>`
    }
  } else if (a.pattern === 'stripes') {
    for (const d of ['M100 48 L100 64', 'M87 50 L90 63', 'M113 50 L110 63', 'M46 94 L62 97', 'M46 104 L61 104', 'M154 94 L138 97', 'M154 104 L139 104']) {
      s += `<path d="${d}" stroke="${a.mark}" stroke-width="4.5" stroke-linecap="round"/>`
    }
  } else if (a.pattern === 'mask') {
    s += `<path d="M100 60 Q74 76 68 100 Q70 130 100 134 Q130 130 132 100 Q126 76 100 60 Z" fill="#ffffff"/>`
    s += `<circle cx="78" cy="74" r="4" fill="#ffffff"/><circle cx="122" cy="74" r="4" fill="#ffffff"/>`
  } else if (a.pattern === 'blaze') {
    s += `<path d="M100 56 Q88 88 78 108 Q100 134 122 108 Q112 88 100 56 Z" fill="#ffffff"/>`
    s += `<ellipse cx="62" cy="112" rx="18" ry="14" fill="#ffffff"/><ellipse cx="138" cy="112" rx="18" ry="14" fill="#ffffff"/>`
  } else if (a.pattern === 'patches') {
    s += `<path d="M44 82 Q46 48 84 44 Q96 60 80 84 Q62 94 44 82Z" fill="#f08a2e"/>`
    s += `<path d="M156 80 Q156 48 118 44 Q108 58 124 80 Q142 92 156 80Z" fill="#35343c"/>`
  } else if (a.pattern === 'points') {
    s += `<ellipse cx="100" cy="106" rx="31" ry="27" fill="${a.mark}" opacity="0.92"/>`
  }
  return s ? `<g clip-path="url(#hc${id})">${s}</g>` : ''
}

function muzzle(a) {
  if (a.kind === 'dog') {
    const color = a.pattern === 'blaze' || a.pattern === 'mask' ? '#ffffff' : a.light
    return `<ellipse cx="100" cy="110" rx="27" ry="19" fill="${color}"/>`
  }
  const color = a.pattern === 'points' ? '#8a6a58' : a.light
  return `<ellipse cx="100" cy="108" rx="19" ry="13" fill="${color}"/>`
}

function nose(a) {
  if (a.kind === 'dog') {
    return `<path d="M90 99 Q100 93 110 99 Q106 109 100 110 Q94 109 90 99Z" fill="${a.nose}" stroke="${OUT}" stroke-width="1.5" stroke-linejoin="round"/>` +
      `<ellipse cx="96" cy="98" rx="3" ry="1.6" fill="#fff" opacity="0.6"/>`
  }
  return `<path d="M94.5 100 L105.5 100 L100 107 Z" fill="${a.nose}" stroke="${a.nose}" stroke-width="2.2" stroke-linejoin="round"/>`
}

function whiskers(a) {
  if (a.kind !== 'cat') return ''
  const c = a.whisker || '#6b5a52'
  let s = ''
  for (const [x1, y1, x2, y2] of [[80, 108, 44, 100], [80, 112, 42, 114], [81, 116, 46, 127]]) {
    s += `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${c}" stroke-width="1.8" stroke-linecap="round" opacity="0.8"/>`
    s += `<path d="M${200 - x1} ${y1} L${200 - x2} ${y2}" stroke="${c}" stroke-width="1.8" stroke-linecap="round" opacity="0.8"/>`
  }
  return s
}

function eyeOpen(a, x, y) {
  const slit = a.kind === 'cat' || a.slit
  const big = slit ? 1.08 : 1
  const hi = `<circle cx="${x - 3}" cy="${y - 4}" r="3.3" fill="#fff"/><circle cx="${x + 3.5}" cy="${y + 3.5}" r="1.6" fill="#fff"/>`
  if (a.iris) {
    return `<ellipse cx="${x}" cy="${y}" rx="${9.5 * big}" ry="${11 * big}" fill="${a.iris}" stroke="${DARK_EYE}" stroke-width="1.5"/>` +
      `<ellipse cx="${x}" cy="${y + 0.5}" rx="${slit ? 3.6 : 5.2}" ry="${7.4 * big}" fill="${DARK_EYE}"/>` + hi
  }
  return `<ellipse cx="${x}" cy="${y}" rx="${8.2 * big}" ry="${10 * big}" fill="${DARK_EYE}"/>` + hi
}

// Moods and activities that show closed, smiling eyes
const HAPPY_EYES = new Set(['happy', 'eating', 'snacking', 'playing', 'cuddling', 'bathing'])

function eyes(a, mood) {
  const xs = a.eyeXs || [78, 122]
  const y = a.eyeY || 92
  let s = `<g class="pet-eyes">`
  for (const x of xs) {
    if (HAPPY_EYES.has(mood)) {
      s += `<path d="M${x - 9} ${y + 3} Q${x} ${y - 11} ${x + 9} ${y + 3}" fill="none" stroke="${DARK_EYE}" stroke-width="4.2" stroke-linecap="round"/>`
    } else if (mood === 'sleepy' || mood === 'sleeping') {
      s += `<path d="M${x - 8.5} ${y} Q${x} ${y + 7} ${x + 8.5} ${y}" fill="none" stroke="${DARK_EYE}" stroke-width="3.6" stroke-linecap="round"/>`
    } else {
      s += eyeOpen(a, x, y)
    }
  }
  s += '</g>'
  if (mood === 'sad' || mood === 'hungry') {
    const lift = mood === 'sad' ? 1 : 0.55
    s += `<path d="M${xs[0] - 12} ${y - 10} L${xs[0] + 10} ${y - 10 - 9 * lift}" stroke="${OUT}" stroke-width="3" stroke-linecap="round" fill="none"/>`
    s += `<path d="M${xs[1] + 12} ${y - 10} L${xs[1] - 10} ${y - 10 - 9 * lift}" stroke="${OUT}" stroke-width="3" stroke-linecap="round" fill="none"/>`
  }
  if (mood === 'sad') {
    s += `<path d="M${xs[0] - 8} ${y + 14} q-5 9 0 12 q5 -3 0 -12Z" fill="#7cc7f2" stroke="#4b9cd3" stroke-width="1.2"/>`
  }
  return s
}

function mouth(a, mood) {
  if (a.noMouth) return ''
  const cat = a.kind === 'cat'
  const exotic = !!a.exotic
  const sx = a.mouthW || (cat ? 0.82 : 1)
  const sy = cat ? 0.82 : 1
  const scale = sx !== 1 || sy !== 1 ? `translate(100 108) scale(${sx} ${sy}) translate(-100 -108)` : ''
  const stem = exotic ? '' : `<path d="M100 110 L100 114" stroke="${OUT}" stroke-width="2.6" stroke-linecap="round"/>`
  let m
  if (mood === 'eating' || mood === 'snacking') {
    m = `<g class="pet-chew"><ellipse cx="100" cy="120" rx="9" ry="8" fill="#7a2b36" stroke="${OUT}" stroke-width="2.6"/>` +
      `<ellipse cx="100" cy="125" rx="5" ry="3" fill="#ff8fa3"/></g>`
  } else if (mood === 'sleeping') {
    m = stem +
      `<path d="M94 118 Q100 122 106 118" fill="none" stroke="${OUT}" stroke-width="2.6" stroke-linecap="round"/>`
  } else if (mood === 'happy' || mood === 'playing' || mood === 'cuddling' || mood === 'bathing') {
    m = `<path d="M87 111 Q100 138 113 111 Q100 116 87 111Z" fill="#7a2b36" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>` +
      `<path d="M93 122 Q100 134 107 122 Q100 117 93 122Z" fill="#ff8fa3"/>`
  } else if (mood === 'hungry') {
    m = `<ellipse cx="100" cy="119" rx="5" ry="6.5" fill="#7a2b36" stroke="${OUT}" stroke-width="2.4"/>`
  } else if (mood === 'sad') {
    m = stem +
      `<path d="M90 122 Q100 112 110 122" fill="none" stroke="${OUT}" stroke-width="2.8" stroke-linecap="round"/>`
  } else if (mood === 'dirty') {
    m = stem +
      `<path d="M91 118 L109 118" stroke="${OUT}" stroke-width="2.8" stroke-linecap="round"/>`
  } else if (exotic) {
    m = `<path d="M88 114 Q100 124 112 114" fill="none" stroke="${OUT}" stroke-width="2.8" stroke-linecap="round"/>`
  } else {
    m = stem +
      `<path d="M89 114 Q94.5 121 100 114 Q105.5 121 111 114" fill="none" stroke="${OUT}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`
  }
  return scale ? `<g transform="${scale}">${m}</g>` : m
}

const BLUSH = `<ellipse cx="62" cy="110" rx="8" ry="5.5" fill="#ff8aa0" opacity="0.5"/><ellipse cx="138" cy="110" rx="8" ry="5.5" fill="#ff8aa0" opacity="0.5"/>`

function overlays(a, mood) {
  let s = ''
  if (mood === 'eating' || mood === 'snacking') {
    s += BLUSH
    s += `<text class="pet-bite" x="100" y="156" font-size="30" text-anchor="middle">${mood === 'eating' ? '🍗' : '🦴'}</text>`
    s += `<circle class="pet-float" cx="76" cy="132" r="2.4" fill="#d9a35b"/><circle class="pet-float pet-float-2" cx="126" cy="136" r="2.2" fill="#d9a35b"/>`
  } else if (mood === 'playing') {
    s += BLUSH
    s += `<text class="pet-ball" x="160" y="182" font-size="30" text-anchor="middle">🎾</text>`
    s += heart(40, 48, 1.1, '#ffd552', 'pet-float') + heart(168, 60, 1, '#7be0a8', 'pet-float pet-float-2')
  } else if (mood === 'sleeping') {
    s += `<path d="M50 156 Q100 146 150 156 L152 190 Q100 198 48 190 Z" fill="#8fb8ff" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>`
    s += `<path d="M52 168 Q100 160 148 168 M51 180 Q100 172 149 180" fill="none" stroke="#fff" stroke-width="3" opacity="0.6"/>`
    s += `<text class="pet-float" x="150" y="46" font-size="26" font-weight="700" fill="#6f7fb0" font-family="sans-serif">Z</text>`
    s += `<text class="pet-float pet-float-2" x="170" y="28" font-size="18" font-weight="700" fill="#6f7fb0" font-family="sans-serif">z</text>`
    s += `<text x="26" y="40" font-size="22">🌙</text>`
  } else if (mood === 'cuddling') {
    s += BLUSH
    s += heart(166, 56, 1.6, '#ff5c7c', 'pet-float') + heart(30, 66, 1.3, '#ff8fa3', 'pet-float pet-float-2') + heart(100, 22, 1.1, '#ff5c7c', 'pet-float')
  } else if (mood === 'bathing') {
    s += BLUSH
    for (const [x, y, r] of [[78, 52, 11], [100, 44, 13], [122, 52, 11], [90, 40, 8], [112, 38, 8]]) {
      s += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="#bfe3f5" stroke-width="2"/>`
    }
    for (const [x, y, r, c] of [[34, 120, 9, ''], [168, 108, 7, 'pet-float-2'], [42, 160, 6, 'pet-float-2'], [160, 150, 10, ''], [24, 84, 5, '']]) {
      s += `<circle class="pet-float ${c}" cx="${x}" cy="${y}" r="${r}" fill="#dff3fc" stroke="#7cc7f2" stroke-width="2"/>`
    }
  } else if (mood === 'happy') {
    s += `<ellipse cx="62" cy="110" rx="8" ry="5.5" fill="#ff8aa0" opacity="0.5"/><ellipse cx="138" cy="110" rx="8" ry="5.5" fill="#ff8aa0" opacity="0.5"/>`
    s += heart(166, 52, 1.5, '#ff5c7c', 'pet-float') + heart(30, 66, 1.1, '#ff8fa3', 'pet-float pet-float-2')
  } else if (mood === 'hungry') {
    s += `<circle cx="150" cy="36" r="4" fill="#fff" stroke="${OUT}" stroke-width="1.5"/><circle cx="138" cy="50" r="2.6" fill="#fff" stroke="${OUT}" stroke-width="1.5"/>`
    s += `<ellipse cx="166" cy="24" rx="26" ry="18" fill="#fff" stroke="${OUT}" stroke-width="2.4"/>`
    s += `<text x="166" y="32" font-size="22" text-anchor="middle">🍖</text>`
  } else if (mood === 'dirty') {
    for (const d of ['M26 78 q-7 -9 0 -16 q7 -9 0 -18', 'M176 84 q-7 -9 0 -16 q7 -9 0 -18', 'M40 52 q-6 -7 0 -12 q6 -7 0 -14']) {
      s += `<path class="pet-float" d="${d}" fill="none" stroke="#7bbf5a" stroke-width="3.2" stroke-linecap="round"/>`
    }
    for (const [x, y, r] of [[70, 150, 7], [132, 172, 6], [84, 66, 4.5], [140, 138, 5]]) {
      s += `<circle cx="${x}" cy="${y}" r="${r}" fill="#7b5a34" opacity="0.5"/>`
    }
  } else if (mood === 'sleepy') {
    s += `<text class="pet-float" x="150" y="46" font-size="26" font-weight="700" fill="#6f7fb0" font-family="sans-serif">Z</text>`
    s += `<text class="pet-float pet-float-2" x="170" y="28" font-size="18" font-weight="700" fill="#6f7fb0" font-family="sans-serif">z</text>`
  }
  return s
}

// --- Accessories ----------------------------------------------------------

function collar(id, uid) {
  const band = (color, extra = '') =>
    `<path d="M62 123 Q100 143 138 123" fill="none" stroke="${OUT}" stroke-width="13" stroke-linecap="round"/>` +
    `<path d="M62 123 Q100 143 138 123" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"${extra}/>`
  switch (id) {
    case 'collar-red':
      return band('#e5484d') + `<circle cx="100" cy="140" r="5.5" fill="#ffc82a" stroke="${OUT}" stroke-width="2"/>`
    case 'collar-bell':
      return band('#3b82f6') +
        `<circle cx="100" cy="142" r="7.5" fill="#ffc82a" stroke="${OUT}" stroke-width="2.2"/>` +
        `<path d="M93 143 h14" stroke="${OUT}" stroke-width="1.6"/><circle cx="100" cy="147" r="1.4" fill="${OUT}"/>`
    case 'collar-rainbow':
      return `<linearGradient id="rb${uid}" x1="62" y1="0" x2="138" y2="0" gradientUnits="userSpaceOnUse">` +
        ['#ef4444', '#f59e0b', '#facc15', '#22c55e', '#3b82f6', '#8b5cf6'].map((c, i) => `<stop offset="${i * 20}%" stop-color="${c}"/>`).join('') +
        '</linearGradient>' +
        `<path d="M62 123 Q100 143 138 123" fill="none" stroke="${OUT}" stroke-width="13" stroke-linecap="round"/>` +
        `<path d="M62 123 Q100 143 138 123" fill="none" stroke="url(#rb${uid})" stroke-width="8" stroke-linecap="round"/>` +
        `<circle cx="100" cy="140" r="5" fill="#fff" stroke="${OUT}" stroke-width="2"/>`
    case 'collar-diamond':
      return band('#d5dde8') +
        `<path d="M100 131 L109 140 L100 153 L91 140 Z" fill="#8fdcff" stroke="${OUT}" stroke-width="2.2" stroke-linejoin="round"/>` +
        `<path d="M95 140 L105 140 M100 133 L100 150" stroke="#fff" stroke-width="1.2" opacity="0.8"/>` +
        `<path d="M118 130 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2 l4 -2z" fill="#fff" stroke="#8fdcff" stroke-width="0.8"/>`
    default:
      return ''
  }
}

function headItem(id) {
  switch (id) {
    case 'hat-bow':
      return `<g transform="translate(132 54) rotate(16)">` +
        `<path d="M0 0 L-22 -13 L-22 13 Z" fill="#ff7eb6" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>` +
        `<path d="M0 0 L22 -13 L22 13 Z" fill="#ff7eb6" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>` +
        `<circle r="6" fill="#e0509a" stroke="${OUT}" stroke-width="2.2"/></g>`
    case 'hat-party':
      return `<g transform="rotate(-9 100 56)">` +
        `<path d="M100 14 L76 58 L124 58 Z" fill="#7c5cff" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>` +
        `<circle cx="95" cy="40" r="3.4" fill="#ffd552"/><circle cx="106" cy="48" r="3.4" fill="#ff7eb6"/><circle cx="90" cy="52" r="3" fill="#7be0a8"/>` +
        `<circle cx="100" cy="13" r="7" fill="#ffd552" stroke="${OUT}" stroke-width="2.4"/></g>`
    case 'hat-flowers': {
      const colors = ['#ff8fb8', '#ffffff', '#ffd552', '#ff8fb8', '#ffffff', '#ffd552']
      const pts = [[62, 64], [75, 52], [90, 46], [110, 46], [125, 52], [138, 64]]
      let s = `<path d="M58 68 Q100 30 142 68" fill="none" stroke="#4f9d57" stroke-width="5" stroke-linecap="round"/>`
      pts.forEach(([x, y], i) => {
        s += `<ellipse cx="${x + (i < 3 ? -5 : 5)}" cy="${y + 7}" rx="6" ry="3" fill="#6bbf6e" stroke="${OUT}" stroke-width="1.4" transform="rotate(${i < 3 ? -30 : 30} ${x} ${y + 7})"/>`
      })
      pts.forEach(([x, y], i) => {
        s += `<circle cx="${x}" cy="${y}" r="8" fill="${colors[i]}" stroke="${OUT}" stroke-width="2"/><circle cx="${x}" cy="${y}" r="3.2" fill="${i % 3 === 2 ? '#ff8fb8' : '#ffc82a'}"/>`
      })
      return s
    }
    case 'hat-crown':
      return `<path d="M68 58 L70 24 L87 42 L100 18 L113 42 L130 24 L132 58 Z" fill="#ffc82a" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>` +
        `<rect x="68" y="50" width="64" height="9" rx="2" fill="#e6a400" stroke="${OUT}" stroke-width="2.4"/>` +
        `<circle cx="100" cy="38" r="4" fill="#e5484d" stroke="${OUT}" stroke-width="1.6"/>` +
        `<circle cx="78" cy="46" r="3" fill="#3b82f6" stroke="${OUT}" stroke-width="1.4"/><circle cx="122" cy="46" r="3" fill="#22c55e" stroke="${OUT}" stroke-width="1.4"/>` +
        `<circle cx="70" cy="24" r="3" fill="#fff" stroke="${OUT}" stroke-width="1.4"/><circle cx="130" cy="24" r="3" fill="#fff" stroke="${OUT}" stroke-width="1.4"/>`
    default:
      return ''
  }
}

function faceItem(id) {
  switch (id) {
    case 'glasses-round':
      return `<g fill="rgba(255,255,255,0.28)" stroke="#2a2a2a" stroke-width="3">` +
        `<circle cx="78" cy="92" r="14.5"/><circle cx="122" cy="92" r="14.5"/></g>` +
        `<path d="M92 90 Q100 85 108 90 M64 90 L54 86 M136 90 L146 86" fill="none" stroke="#2a2a2a" stroke-width="3" stroke-linecap="round"/>`
    case 'glasses-cool':
      return `<rect x="62" y="80" width="32" height="23" rx="9" fill="#1f1f2e" stroke="#0e0e16" stroke-width="2.4"/>` +
        `<rect x="106" y="80" width="32" height="23" rx="9" fill="#1f1f2e" stroke="#0e0e16" stroke-width="2.4"/>` +
        `<path d="M94 86 L106 86 M62 85 L52 82 M138 85 L148 82" stroke="#0e0e16" stroke-width="3.4" stroke-linecap="round"/>` +
        `<path d="M68 86 L76 86 M112 86 L120 86" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity="0.6"/>`
    case 'glasses-heart': {
      const h = (x) => `<path transform="translate(${x} 92) scale(1.25)" d="M0 9 C-19 -6 -11 -19 0 -9 C11 -19 19 -6 0 9Z" fill="#ff5c8a" fill-opacity="0.88" stroke="#b3124f" stroke-width="2.2" stroke-linejoin="round"/>`
      return h(78) + h(122) + `<path d="M91 88 Q100 84 109 88" fill="none" stroke="#b3124f" stroke-width="2.6" stroke-linecap="round"/>`
    }
    default:
      return ''
  }
}

// --- Public ---------------------------------------------------------------

// Decide how the pet feels from its stats (each 0-100).
export function petMood(pet) {
  if (!pet) return 'content'
  const needs = [
    ['hungry', pet.fullness],
    ['dirty', pet.clean],
    ['sleepy', pet.rest],
    ['sad', pet.love],
  ].filter(([, v]) => v < 30).sort((x, y) => x[1] - y[1])
  if (needs.length) return needs[0][0]
  if (pet.fullness > 60 && pet.love > 60 && pet.clean > 50 && pet.rest > 40) return 'happy'
  return 'content'
}

// --- Growing up ------------------------------------------------------------
// Pets look a little older as they level up: small and baby-like at first, nearly full size when
// grown, and full size with grey eyebrows and a frosty muzzle at the wise stages (level 22+).
const AGE_STAGES = [
  { key: 'baby', label: 'Baby', max: 4, scale: 0.78 },
  { key: 'young', label: 'Young', max: 11, scale: 0.88 },
  { key: 'grown', label: 'Grown-up', max: 21, scale: 0.96 },
  { key: 'wise', label: 'Wise', max: 30, scale: 1 },
]

export function ageStage(level) {
  return AGE_STAGES.find(st => level <= st.max) || AGE_STAGES[AGE_STAGES.length - 1]
}

function elderDetails(a, level) {
  const xs = a.eyeXs || [78, 122]
  const y = a.eyeY || 92
  let s = ''
  for (const x of xs) {
    s += `<path d="M${x - 10} ${y - 15} Q${x} ${y - 24} ${x + 10} ${y - 13}" fill="none" stroke="#aeabb8" stroke-width="4" stroke-linecap="round"/>`
  }
  if (level >= 30) {
    const star = (x, yy, r) =>
      `<path d="M${x} ${yy - r} L${x + r * 0.28} ${yy - r * 0.28} L${x + r} ${yy} L${x + r * 0.28} ${yy + r * 0.28} L${x} ${yy + r} L${x - r * 0.28} ${yy + r * 0.28} L${x - r} ${yy} L${x - r * 0.28} ${yy - r * 0.28}Z" fill="#ffd54a" stroke="#fff" stroke-width="1"/>`
    s += `<g class="pet-float">${star(24, 40, 9)}</g><g class="pet-float pet-float-2">${star(178, 34, 7)}</g><g class="pet-float">${star(36, 150, 6)}</g>`
  }
  return s
}

export function petSvg({ species, mood = 'content', collar: collarId = null, head = null, face = null, size = '100%', level = 15 }) {
  const a = SPECIES_ART[species] || SPECIES_ART['golden-retriever']
  const id = ++seq
  const cat = a.kind === 'cat'
  const exotic = !!a.exotic
  const rx = a.headRx || (cat ? 56 : 54)
  const ry = a.headRy || (cat ? 44 : 46)
  const stage = ageStage(level)

  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}" role="img" aria-hidden="true">`
  // Everything is scaled from the paws so a baby sits on the ground and just looks smaller
  s += `<g transform="translate(100 193) scale(${stage.scale}) translate(-100 -193)">`
  s += `<ellipse cx="100" cy="193" rx="58" ry="6" fill="#000" opacity="0.14"/>`
  s += `<clipPath id="hc${id}"><ellipse cx="100" cy="92" rx="${rx}" ry="${ry}"/></clipPath>`

  let layers = null
  if (exotic) {
    layers = exoticLayers(a, id, mood)
    s += layers.back + layers.body + layers.mid
  } else {
    s += tail(a)
    s += body(a, id)
    // Ears behind the head
    if (a.ear !== 'floppy') {
      s += earShape(a, 1) + mirror(earShape(a, a.earColor2 ? 2 : 1))
    }
  }

  s += `<ellipse cx="100" cy="92" rx="${rx}" ry="${ry}" fill="${a.base}" stroke="${OUT}" stroke-width="3"/>`
  if (exotic) {
    s += layers.face
  } else {
    s += headPattern(a, id)
    // Floppy ears hang in front of the head edges
    if (a.ear === 'floppy') {
      s += earShape(a, 1) + mirror(earShape(a, 1))
    }
    s += muzzle(a)
    if (stage.key === 'wise') s += `<ellipse cx="100" cy="114" rx="24" ry="13" fill="#c9c7d4" opacity="0.35"/>`
    s += nose(a) + whiskers(a)
  }

  s += eyes(a, mood)
  s += mouth(a, mood)
  if (exotic) s += layers.front
  if (mood === 'dirty') {
    s += `<circle cx="64" cy="76" r="4.5" fill="#7b5a34" opacity="0.5"/><circle cx="136" cy="116" r="4" fill="#7b5a34" opacity="0.5"/>`
  }
  if (stage.key === 'wise') s += elderDetails(a, level)
  s += collar(collarId, id)
  // Glasses follow the eyes (the frog's sit up on its bumps)
  s += `<g transform="translate(0 ${(a.eyeY || 92) - 92})">${faceItem(face)}</g>`
  s += headItem(head)
  s += overlays(a, mood)
  return s + '</g></svg>'
}
