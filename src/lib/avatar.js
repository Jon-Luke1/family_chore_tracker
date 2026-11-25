import { supabase } from './supabase'

const SIZE = 256

// Center-crop an image file to a small square JPEG so uploads stay tiny.
async function toSquareJpeg(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('That file could not be read as a picture'))
      el.src = url
    })
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    const sx = (img.naturalWidth - side) / 2
    const sy = (img.naturalHeight - side) / 2
    const canvas = document.createElement('canvas')
    canvas.width = SIZE
    canvas.height = SIZE
    canvas.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!blob) throw new Error('Could not process that picture')
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Stored at "<child id>.jpg" in the private "avatars" bucket (one photo per child).
export async function uploadAvatar(childId, file) {
  const blob = await toSquareJpeg(file)
  const { error } = await supabase.storage
    .from('avatars')
    .upload(`${childId}.jpg`, blob, { upsert: true, contentType: 'image/jpeg' })
  if (error) throw error
}
