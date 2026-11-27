import { useMemo } from 'react'
import { petSvg } from '../lib/petArt'

// A cartoon pet. The SVG comes from petSvg(), which only uses fixed palettes and
// item ids (never user text), so injecting it as HTML is safe.
export default function PetSprite({ species, mood = 'content', collar = null, head = null, face = null, level = 15, size = 200, className = '' }) {
  const svg = useMemo(
    () => petSvg({ species, mood, collar, head, face, level }),
    [species, mood, collar, head, face, level]
  )
  return (
    <div
      className={className}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
