// ============================================================
//  Aide à l'embarquement vidéo : convertit une URL "grand public"
//  (YouTube / Vimeo) en URL d'iframe embarquable. Sinon, on considère
//  que c'est un fichier vidéo direct (<video>).
// ============================================================

export type VideoEmbed =
  | { kind: 'iframe'; src: string }
  | { kind: 'file'; src: string }

export function resolveVideoEmbed(rawUrl: string): VideoEmbed {
  const url = rawUrl.trim()

  // YouTube : youtu.be/ID, watch?v=ID, /embed/ID, /shorts/ID
  const yt =
    url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)
  if (yt) {
    return { kind: 'iframe', src: `https://www.youtube.com/embed/${yt[1]}` }
  }

  // Vimeo : vimeo.com/123456789
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vimeo) {
    return { kind: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}` }
  }

  // Sinon : fichier vidéo direct (mp4, webm…) lu par la balise <video>.
  return { kind: 'file', src: url }
}
