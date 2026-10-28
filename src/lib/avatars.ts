/** Parts must match avatar_faces(), avatar_backgrounds(), and avatar_marks() in SQL. */
export const FACES = ['mira', 'nino', 'cleo', 'otto', 'lumi', 'pino', 'sora', 'remy'] as const

export const BACKGROUNDS = [
  { id: 'clay', color: '#c45c26' },
  { id: 'ink', color: '#2a2420' },
  { id: 'leaf', color: '#2f6b45' },
  { id: 'wine', color: '#8a3d45' },
  { id: 'sea', color: '#2f5f6b' },
  { id: 'plum', color: '#5c4570' },
  { id: 'sand', color: '#c4a06a' },
  { id: 'dusk', color: '#d4784a' },
] as const

export const MARKS = ['none', 'book', 'star', 'note', 'leaf'] as const

export type FaceId = (typeof FACES)[number]
export type BackgroundId = (typeof BACKGROUNDS)[number]['id']
export type MarkId = (typeof MARKS)[number]

const faceIds = new Set<string>(FACES)
const backgroundIds = new Set<string>(BACKGROUNDS.map((item) => item.id))
const markIds = new Set<string>(MARKS)

export const DEFAULT_FACE: FaceId = 'mira'
export const DEFAULT_BACKGROUND: BackgroundId = 'clay'
export const DEFAULT_MARK: MarkId = 'none'
export const DEFAULT_AVATAR = 'mira.clay.none'

export function backgroundColor(id: BackgroundId): string {
  return BACKGROUNDS.find((item) => item.id === id)?.color ?? BACKGROUNDS[0].color
}

export function avatarId(face: FaceId, background: BackgroundId, mark: MarkId): string {
  return `${face}.${background}.${mark}`
}

export function isAvatar(value: string): boolean {
  const [face, background, mark, extra] = value.split('.')
  return extra === undefined && faceIds.has(face) && backgroundIds.has(background) && markIds.has(mark)
}

export function parseAvatar(value: string): { face: FaceId; background: BackgroundId; mark: MarkId } {
  if (!isAvatar(value)) {
    return { face: DEFAULT_FACE, background: DEFAULT_BACKGROUND, mark: DEFAULT_MARK }
  }
  const [face, background, mark] = value.split('.')
  return { face: face as FaceId, background: background as BackgroundId, mark: mark as MarkId }
}
