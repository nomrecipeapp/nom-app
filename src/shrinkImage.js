// Shrink a photo before uploading it. iPhone photos are often 3 to 6 MB;
// nobody needs that much on a phone screen. Resizing to at most 1600px on the
// long side (512px for profile photos) makes the feed load much faster and
// keeps Supabase's 1 GB free storage from filling up. If anything goes wrong,
// the original file is uploaded unchanged.
export async function shrinkImage(file, maxSize = 1600, quality = 0.82) {
  try {
    if (!file || !file.type?.startsWith('image/') || file.type === 'image/gif') return file
    const url = URL.createObjectURL(file)
    const img = await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = url
    })
    URL.revokeObjectURL(url)
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
    if (scale === 1 && file.size < 600 * 1024) return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}
