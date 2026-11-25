import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// A child's photo from the private avatars bucket (via a short-lived signed link).
// Shows `fallback` (or the first letter of the name) when there's no photo.
// Change `version` to force a re-fetch after uploading a new photo.
export default function Avatar({ childId, name = '', size = 40, fallback = null, version = 0 }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    let cancelled = false
    setUrl(null)
    if (!childId) return
    supabase.storage.from('avatars').createSignedUrl(`${childId}.jpg`, 3600)
      .then(({ data, error }) => {
        if (!cancelled) setUrl(error ? null : data?.signedUrl || null)
      })
    return () => { cancelled = true }
  }, [childId, version])

  const style = { width: size, height: size }

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={style}
        className="rounded-full object-cover shrink-0"
        onError={() => setUrl(null)}
      />
    )
  }

  if (fallback) {
    return <span style={style} className="inline-flex items-center justify-center shrink-0">{fallback}</span>
  }

  return (
    <span
      style={{ ...style, fontSize: size * 0.45 }}
      className="inline-flex items-center justify-center rounded-full bg-sage-100 text-forest-800 font-semibold shrink-0"
    >
      {(name || '?').charAt(0).toUpperCase()}
    </span>
  )
}
