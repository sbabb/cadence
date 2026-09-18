import { buildBackup, backupFilename } from './backup.js'
import { renderReportCardBlob } from './reportCardImage.js'

// Getting a file out of the app and back into it.
//
// Kept apart from backup.js on purpose: that module is pure data and can be
// exercised by the verify scripts in plain Node, which is worth more than the
// convenience of having all of it in one file. Everything that needs a browser
// is here.

// Two routes out, because phones disagree about what "save this file" means.
//
// The share sheet is the better one where it exists: it puts the backup
// straight into Drive, Files or an email, which is where a backup is actually
// useful. Plain downloads on an installed iOS web app have historically been
// the flakiest path in this whole feature. Where sharing isn't available, a
// download link is - so the app tries the good one and keeps the old one as
// the floor.
export async function saveTextFile(filename, text, mimeType = 'application/json') {
  return saveBlobFile(filename, new Blob([text], { type: mimeType }), mimeType)
}

// The same two routes out, for something that was never text. A report card
// is a PNG, and a PNG is worth sharing far more often than a backup is - the
// share sheet is the whole point of saving one.
export async function saveBlobFile(filename, blob, mimeType) {
  if (typeof File === 'function' && navigator.canShare && navigator.share) {
    try {
      const file = new File([blob], filename, { type: mimeType })
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename })
        return 'shared'
      }
    } catch (err) {
      // Dismissing the share sheet throws, and is not a failure - the user
      // simply changed their mind, and telling them something went wrong
      // would be a lie.
      if (err && err.name === 'AbortError') return 'cancelled'
      // Anything else: fall through and try the download instead.
    }
  }

  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // Revoking immediately can cancel the download on some browsers; a tick
    // later is enough and still cleans up.
    setTimeout(() => URL.revokeObjectURL(url), 10000)
    return 'downloaded'
  } catch (err) {
    console.error('Failed to save file:', err)
    return 'failed'
  }
}

// The whole export, in one call, so every place that offers a backup
// produces an identical file.
export function exportBackup(data) {
  return saveTextFile(backupFilename(), JSON.stringify(buildBackup(data), null, 2))
}

// A period's report card as a shareable PNG, in one call.
export async function exportReportCard(card) {
  const blob = await renderReportCardBlob(card)
  if (!blob) return 'failed'
  return saveBlobFile(card.filename, blob, 'image/png')
}

export function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error || new Error('Could not read that file.'))
    reader.readAsText(file)
  })
}
