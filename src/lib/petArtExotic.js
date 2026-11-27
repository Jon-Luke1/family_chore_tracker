// Second-tier pets: birds, lizards, a frog, a turtle, a hedgehog and an axolotl.
// They share the head, eyes and mouth of the cats and dogs in petArt.js and add their own
// body parts. exoticLayers() returns SVG strings for four layers (back, mid, face, front);
// everything comes from the fixed palettes below, never from user text.

const OUT = '#3b2f2f'

export const EXOTIC_ART = {
  budgie: {
    kind: 'bird', exotic: 'budgie', noMouth: true,
    base: '#ffe45e', body: '#6fd05a', light: '#d9f5a8', wing: '#3fa84a', mark: '#2b2b33',
    cheek: '#4aa3f0', beak: '#ff9a3c', paw: '#ffb36a',
  },
  cockatiel: {
    kind: 'bird', exotic: 'cockatiel', noMouth: true,
    base: '#ffe06a', body: '#a7aab8', light: '#d6d8e2', wing: '#8a8d9c', mark: '#ffffff',
    cheek: '#ff8a3d', beak: '#9b9aa5', paw: '#cfc9be', crest: '#ffd84a',
  },
  'bearded-dragon': {
    kind: 'lizard', exotic: 'bearded-dragon', slit: true, mouthW: 1.25,
    base: '#d9a35f', light: '#f3dba8', mark: '#a8742f', spike: '#b27a38', beard: '#c58e45',
    paw: '#d9a35f', iris: '#e0a030',
  },
  'leopard-gecko': {
    kind: 'lizard', exotic: 'leopard-gecko', slit: true, mouthW: 1.2,
    base: '#f4cd62', light: '#fff0c4', mark: '#7a4f2a', paw: '#f4cd62', iris: '#f0b429',
  },
  'tree-frog': {
    kind: 'frog', exotic: 'tree-frog', eyeY: 64, eyeXs: [74, 126], mouthW: 1.5,
    base: '#74d65a', light: '#eaf9cc', mark: '#4fa83e', paw: '#5fc24a', pad: '#e8f58a',
  },
  hedgehog: {
    kind: 'hedgehog', exotic: 'hedgehog',
    base: '#f3d9b8', light: '#fff0dc', spine: '#7a5c46', spine2: '#a98466', paw: '#f0c9a0',
    nose: '#3b2a20', ear: '#f4b6b6',
  },
  'red-eared-turtle': {
    kind: 'turtle', exotic: 'red-eared-turtle', mouthW: 1.1,
    base: '#79c36a', light: '#c9e8a8', shell: '#4e9a52', shell2: '#2f7a3d', paw: '#79c36a',
    red: '#e5484d', stripe: '#ffe45e',
  },
  axolotl: {
    kind: 'axolotl', exotic: 'axolotl', mouthW: 1.3,
    base: '#ffc6d8', light: '#ffe6ee', gill: '#ff7a9a', gill2: '#ff9eb5', paw: '#ffc6d8', mark: '#ffadc4',
  },
}

const mirror = (inner) => `<g transform="translate(200 0) scale(-1 1)">${inner}</g>`

const strokeTail = (d, color, outer, inner, extra = '') =>
  `<g class="pet-tail"><path d="${d}" fill="none" stroke="${OUT}" stroke-width="${outer}" stroke-linecap="round"/>` +
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${inner}" stroke-linecap="round"/>${extra}</g>`

const hex = (cx, cy, r) => {
  const pts = []
  for (let i = 0; i < 6; i++) {
    const t = (Math.PI / 3) * i + Math.PI / 6
    pts.push(`${(cx + r * Math.cos(t)).toFixed(1)} ${(cy + r * Math.sin(t)).toFixed(1)}`)
  }
  return `M${pts.join(' L')} Z`
}

// A ring of spikes (the hedgehog's back, the dragon's frill). Angles in radians.
function spikes(cx, cy, rx, ry, n, from, to, depth) {
  const pts = []
  const steps = n * 2
  for (let i = 0; i <= steps; i++) {
    const t = from + ((to - from) * i) / steps
    const k = i % 2 ? 1 - depth : 1
    pts.push(`${(cx + rx * k * Math.cos(t)).toFixed(1)} ${(cy + ry * k * Math.sin(t)).toFixed(1)}`)
  }
  return pts
}

const feather = (x, y, rot, color) =>
  `<path transform="translate(${x} ${y}) rotate(${rot})" d="M0 0 Q-9 -20 3 -40 Q15 -22 9 0Z" fill="${color}" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>`

function bird(a, mood) {
  const open = ['happy', 'eating', 'snacking', 'playing', 'cuddling', 'bathing', 'hungry'].includes(mood)
  const beak = open
    ? `<path d="M91 96 Q100 90 109 96 Q106 103 100 105 Q94 103 91 96Z" fill="${a.beak}" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/>` +
      `<ellipse cx="100" cy="107" rx="6.5" ry="2.8" fill="#7a2b36"/>` +
      `<path d="M93 108 Q100 120 107 108 Q100 112 93 108Z" fill="${a.beak}" stroke="${OUT}" stroke-width="2.2" stroke-linejoin="round"/>`
    : `<path d="M91 98 Q100 91 109 98 Q108 108 100 114 Q92 108 91 98Z" fill="${a.beak}" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/>` +
      `<path d="M96 104 L104 104" stroke="${OUT}" stroke-width="1.6" stroke-linecap="round" opacity="0.6"/>`
  return beak + `<circle cx="96" cy="99" r="1.1" fill="${OUT}"/><circle cx="104" cy="99" r="1.1" fill="${OUT}"/>`
}

export function exoticLayers(a, id, mood) {
  let back = ''
  let mid = ''
  let face = ''
  let front = ''
  let bodyColor = a.base
  let bodyExtra = ''

  switch (a.exotic) {
    case 'budgie':
      back = strokeTail('M140 172 Q176 188 190 160', a.wing, 16, 10)
      bodyColor = a.body
      bodyExtra =
        `<ellipse cx="54" cy="150" rx="13" ry="26" transform="rotate(10 54 150)" fill="${a.wing}" stroke="${OUT}" stroke-width="2.6"/>` +
        `<ellipse cx="146" cy="150" rx="13" ry="26" transform="rotate(-10 146 150)" fill="${a.wing}" stroke="${OUT}" stroke-width="2.6"/>`
      for (const [x, y] of [[80, 60], [100, 54], [120, 60], [90, 70], [110, 70]]) {
        face += `<path d="M${x - 5} ${y} q5 -6 10 0" fill="none" stroke="${a.mark}" stroke-width="2.4" stroke-linecap="round"/>`
      }
      face += `<ellipse cx="62" cy="106" rx="9" ry="6.5" fill="${a.cheek}"/><ellipse cx="138" cy="106" rx="9" ry="6.5" fill="${a.cheek}"/>`
      front = bird(a, mood)
      break

    case 'cockatiel':
      back = strokeTail('M140 172 Q176 188 190 160', a.wing, 18, 12)
      mid = feather(100, 52, -26, a.crest) + feather(100, 52, 0, a.crest) + feather(100, 52, 26, a.crest)
      bodyColor = a.body
      bodyExtra =
        `<ellipse cx="54" cy="150" rx="13" ry="26" transform="rotate(10 54 150)" fill="${a.wing}" stroke="${OUT}" stroke-width="2.6"/>` +
        `<ellipse cx="146" cy="150" rx="13" ry="26" transform="rotate(-10 146 150)" fill="${a.wing}" stroke="${OUT}" stroke-width="2.6"/>` +
        `<path d="M50 140 q4 12 2 24 M150 140 q-4 12 -2 24" stroke="${a.mark}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.9"/>`
      face += `<circle cx="62" cy="104" r="10" fill="${a.cheek}"/><circle cx="138" cy="104" r="10" fill="${a.cheek}"/>`
      front = bird(a, mood)
      break

    case 'bearded-dragon': {
      back = strokeTail('M146 166 Q178 172 172 136 Q170 120 178 112', a.base, 22, 16,
        `<path d="M152 166 Q174 168 172 138" fill="none" stroke="${a.mark}" stroke-width="16" stroke-dasharray="4 11" stroke-dashoffset="3"/>`)
      const sp = spikes(100, 92, 62, 54, 9, Math.PI * 1.02, Math.PI * 1.98, 0.22)
      mid = `<path d="M${sp.join(' L')}" fill="${a.spike}" stroke="${OUT}" stroke-width="2.8" stroke-linejoin="round"/>` +
        // the beard under the chin
        `<path d="M56 108 L42 124 L62 122 L56 142 L76 128 L80 150 L92 132 L100 152 L108 132 L120 150 L124 128 L144 142 L138 122 L158 124 L144 108Z" fill="${a.beard}" stroke="${OUT}" stroke-width="2.8" stroke-linejoin="round"/>`
      for (const [x, y] of [[66, 66], [134, 66], [100, 52], [60, 112], [140, 112]]) {
        face += `<circle cx="${x}" cy="${y}" r="3.2" fill="${a.mark}" opacity="0.55"/>`
      }
      bodyExtra = [[62, 138], [138, 138], [58, 158], [142, 158]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="${a.mark}" opacity="0.5"/>`).join('')
      break
    }

    case 'leopard-gecko':
      back = strokeTail('M146 168 Q176 176 174 142 Q174 126 180 118', a.base, 20, 14,
        `<path d="M154 170 Q174 172 174 142" fill="none" stroke="${a.mark}" stroke-width="14" stroke-dasharray="3 9" stroke-dashoffset="2"/>`)
      for (const [x, y, r] of [[70, 62, 5], [100, 52, 4.5], [132, 64, 5], [56, 92, 4], [146, 94, 4.5], [84, 54, 3], [118, 56, 3.4]]) {
        face += `<circle cx="${x}" cy="${y}" r="${r}" fill="${a.mark}" opacity="0.75"/>`
      }
      bodyExtra = [[66, 134, 6], [134, 130, 5.5], [58, 158, 5], [144, 156, 6.5], [100, 128, 5], [84, 176, 4], [120, 178, 4.5]]
        .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${a.mark}" opacity="0.7"/>`).join('')
      break

    case 'tree-frog':
      face +=
        `<circle cx="74" cy="64" r="23" fill="${a.base}" stroke="${OUT}" stroke-width="3"/>` +
        `<circle cx="126" cy="64" r="23" fill="${a.base}" stroke="${OUT}" stroke-width="3"/>` +
        `<circle cx="94" cy="104" r="1.8" fill="${OUT}"/><circle cx="106" cy="104" r="1.8" fill="${OUT}"/>`
      bodyExtra =
        `<ellipse cx="100" cy="168" rx="30" ry="24" fill="${a.light}"/>` +
        [[60, 132, 6], [140, 128, 5], [56, 156, 5], [146, 158, 6]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${a.mark}" opacity="0.6"/>`).join('')
      break

    case 'hedgehog': {
      const sp = spikes(100, 110, 80, 72, 18, 0, Math.PI * 2, 0.14)
      back = `<path d="M${sp.join(' L')} Z" fill="${a.spine}" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>`
      const sp2 = spikes(100, 110, 66, 58, 14, 0, Math.PI * 2, 0.16)
      back += `<path d="M${sp2.join(' L')} Z" fill="${a.spine2}" opacity="0.55"/>`
      mid =
        `<ellipse cx="50" cy="62" rx="14" ry="13" fill="${a.base}" stroke="${OUT}" stroke-width="3"/><ellipse cx="50" cy="62" rx="7" ry="6.5" fill="${a.ear}"/>` +
        `<ellipse cx="150" cy="62" rx="14" ry="13" fill="${a.base}" stroke="${OUT}" stroke-width="3"/><ellipse cx="150" cy="62" rx="7" ry="6.5" fill="${a.ear}"/>`
      // brown hood across the top of the head
      face = `<path d="M44 76 Q52 42 100 40 Q148 42 156 76 Q150 60 134 64 Q124 54 112 64 Q100 54 88 64 Q76 54 66 64 Q50 60 44 76Z" fill="${a.spine}"/>`
      face += `<ellipse cx="100" cy="108" rx="21" ry="15" fill="${a.light}"/><ellipse cx="100" cy="102" rx="6.5" ry="5" fill="${a.nose}"/>`
      break
    }

    case 'red-eared-turtle':
      back = `<path d="M146 166 Q178 170 188 184 Q164 184 146 178Z" fill="${a.base}" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>`
      bodyColor = a.shell
      bodyExtra =
        `<path d="${hex(100, 164, 17)}" fill="${a.shell2}" opacity="0.55" stroke="${a.shell2}" stroke-width="2.4" stroke-linejoin="round"/>` +
        `<path d="${hex(66, 170, 14)}" fill="none" stroke="${a.shell2}" stroke-width="2.4" stroke-linejoin="round"/>` +
        `<path d="${hex(134, 170, 14)}" fill="none" stroke="${a.shell2}" stroke-width="2.4" stroke-linejoin="round"/>` +
        `<path d="M50 168 Q100 196 150 168" fill="none" stroke="${a.light}" stroke-width="5" stroke-linecap="round" opacity="0.85"/>`
      face =
        `<ellipse cx="54" cy="92" rx="7" ry="11" fill="${a.red}" stroke="${OUT}" stroke-width="2"/>` +
        `<ellipse cx="146" cy="92" rx="7" ry="11" fill="${a.red}" stroke="${OUT}" stroke-width="2"/>` +
        `<path d="M58 118 Q80 124 94 116 M142 118 Q120 124 106 116" fill="none" stroke="${a.stripe}" stroke-width="3.4" stroke-linecap="round"/>` +
        `<circle cx="96" cy="103" r="1.6" fill="${OUT}"/><circle cx="104" cy="103" r="1.6" fill="${OUT}"/>`
      break

    case 'axolotl': {
      const frond = (x, y, dx, dy) =>
        `<path d="M${x} ${y} Q${x + dx * 0.4} ${y + dy * 0.3 - 6} ${x + dx} ${y + dy}" fill="none" stroke="${OUT}" stroke-width="10" stroke-linecap="round"/>` +
        `<path d="M${x} ${y} Q${x + dx * 0.4} ${y + dy * 0.3 - 6} ${x + dx} ${y + dy}" fill="none" stroke="${a.gill}" stroke-width="5.5" stroke-linecap="round"/>` +
        `<circle cx="${x + dx}" cy="${y + dy}" r="5.5" fill="${a.gill2}" stroke="${OUT}" stroke-width="2.2"/>`
      const gills = frond(52, 78, -28, -26) + frond(50, 90, -34, -2) + frond(52, 102, -28, 24)
      back = `<path d="M146 166 Q186 176 192 140 Q176 150 160 142 Q168 154 146 156Z" fill="${a.gill2}" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>` +
        gills + mirror(gills)
      face = `<circle cx="94" cy="102" r="1.6" fill="${OUT}"/><circle cx="106" cy="102" r="1.6" fill="${OUT}"/>` +
        `<ellipse cx="58" cy="108" rx="7" ry="4.5" fill="${a.mark}"/><ellipse cx="142" cy="108" rx="7" ry="4.5" fill="${a.mark}"/>`
      break
    }

    default:
      break
  }

  const body =
    `<clipPath id="bc${id}"><ellipse cx="100" cy="152" rx="50" ry="38"/></clipPath>` +
    `<ellipse cx="100" cy="152" rx="50" ry="38" fill="${bodyColor}" stroke="${OUT}" stroke-width="3"/>` +
    `<g clip-path="url(#bc${id})">` +
    (a.exotic === 'red-eared-turtle' ? '' : `<ellipse cx="100" cy="168" rx="29" ry="26" fill="${a.light}"/>`) +
    bodyExtra + '</g>' +
    [76, 124].map(x =>
      `<ellipse cx="${x}" cy="186" rx="${a.exotic === 'tree-frog' ? 18 : 15}" ry="9" fill="${a.paw}" stroke="${OUT}" stroke-width="3"/>` +
      (a.pad ? `<circle cx="${x - 9}" cy="188" r="3" fill="${a.pad}"/><circle cx="${x}" cy="190" r="3" fill="${a.pad}"/><circle cx="${x + 9}" cy="188" r="3" fill="${a.pad}"/>`
        : `<path d="M${x - 5} 188 v-4 M${x} 189 v-5 M${x + 5} 188 v-4" stroke="${OUT}" stroke-width="1.8" stroke-linecap="round" opacity="0.5"/>`)
    ).join('')

  return { back, body, mid, face, front }
}
