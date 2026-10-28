import { useState, type FormEvent } from 'react'
import { BACKGROUNDS, FACES, MARKS, avatarId, parseAvatar, type BackgroundId, type FaceId, type MarkId } from '../lib/avatars'
import { cleanUsername, usernameError } from '../lib/social'
import { clsx } from '../lib/utils'
import { useSocial } from '../store/social-store'
import type { MessageKey } from '../i18n/messages'
import { useI18n } from '../i18n/translate'
import { AvatarBadge, MarkGlyph } from './AvatarBadge'
import { StreakBadge } from './StreakCard'
import { Button, Card, Field, Input } from './ui'

const colorLabel: Record<BackgroundId, MessageKey> = {
  clay: 'social.color.clay',
  ink: 'social.color.ink',
  leaf: 'social.color.leaf',
  wine: 'social.color.wine',
  sea: 'social.color.sea',
  plum: 'social.color.plum',
  sand: 'social.color.sand',
  dusk: 'social.color.dusk',
}

const markLabel: Record<MarkId, MessageKey> = {
  none: 'social.mark.none',
  book: 'social.mark.book',
  star: 'social.mark.star',
  note: 'social.mark.note',
  leaf: 'social.mark.leaf',
}

export function ProfileCard() {
  const { t } = useI18n()
  const { profile, saveProfile } = useSocial()
  const initial = parseAvatar(profile?.avatar ?? '')
  const [open, setOpen] = useState(!profile?.customized)
  const [draft, setDraft] = useState(profile?.username ?? '')
  const [face, setFace] = useState<FaceId>(initial.face)
  const [background, setBackground] = useState<BackgroundId>(initial.background)
  const [mark, setMark] = useState<MarkId>(initial.mark)
  const avatar = avatarId(face, background, mark)
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  if (!profile) return null

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const name = cleanUsername(draft)
    const issue = usernameError(name)
    if (issue) {
      setMessage({ tone: 'err', text: issue })
      return
    }
    setBusy(true)
    setMessage(null)
    const error = await saveProfile(name, avatar)
    setBusy(false)
    if (error) {
      setMessage({ tone: 'err', text: error })
      return
    }
    setOpen(false)
    setMessage({ tone: 'ok', text: t('social.saved') })
  }

  return (
    <Card className="mb-4 px-4 py-4">
      <div className="flex items-center gap-3">
        <AvatarBadge avatar={open ? avatar : profile.avatar} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-display text-2xl">@{open ? cleanUsername(draft) || profile.username : profile.username}</p>
            <StreakBadge />
          </div>
          {open ? null : (
            <button
              type="button"
              className="mt-1 text-sm font-semibold text-accent"
              onClick={() => {
                const next = parseAvatar(profile.avatar)
                setDraft(profile.username)
                setFace(next.face)
                setBackground(next.background)
                setMark(next.mark)
                setMessage(null)
                setOpen(true)
              }}
            >
              {t('social.edit')}
            </button>
          )}
        </div>
      </div>

      {open ? (
        <form className="mt-4 space-y-4" onSubmit={(event) => void submit(event)}>
          <p className="text-sm leading-6 text-muted">{t('social.lead')}</p>
          <div>
            <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t('social.avatarFace')}</p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {FACES.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={face === item}
                  aria-label={item}
                  onClick={() => setFace(item)}
                  className={clsx(
                    'flex items-center justify-center rounded-2xl py-1.5',
                    face === item ? 'bg-accent/15 ring-2 ring-accent' : 'bg-surface',
                  )}
                >
                  <AvatarBadge avatar={avatarId(item, background, 'none')} size="md" />
                </button>
              ))}
            </div>
            <p className="mt-4 px-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t('social.avatarColor')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {BACKGROUNDS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={background === item.id}
                  aria-label={t(colorLabel[item.id])}
                  onClick={() => setBackground(item.id)}
                  className={clsx(
                    'size-9 rounded-full',
                    background === item.id ? 'ring-2 ring-accent ring-offset-2 ring-offset-card' : '',
                  )}
                  style={{ background: item.color }}
                />
              ))}
            </div>
            <p className="mt-4 px-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t('social.avatarMark')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {MARKS.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={mark === item}
                  aria-label={t(markLabel[item])}
                  onClick={() => setMark(item)}
                  className={clsx(
                    'inline-flex size-11 items-center justify-center rounded-2xl text-fg',
                    mark === item ? 'bg-accent/15 ring-2 ring-accent' : 'bg-surface',
                  )}
                >
                  <MarkGlyph id={item} />
                </button>
              ))}
            </div>
          </div>
          <Field label={t('social.username')}>
            <Input
              value={draft}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={20}
              onChange={(event) => {
                setDraft(cleanUsername(event.target.value))
                setMessage(null)
              }}
            />
          </Field>
          <p className="text-xs leading-5 text-muted">{t('social.usernameHint')}</p>
          <div className="flex gap-2">
            <Button className="flex-1" type="submit" disabled={busy || cleanUsername(draft).length < 3}>
              {t('common.save')}
            </Button>
            {profile.customized ? (
              <Button
                className="flex-1"
                variant="secondary"
                onClick={() => {
                  const next = parseAvatar(profile.avatar)
                  setDraft(profile.username)
                  setFace(next.face)
                  setBackground(next.background)
                  setMark(next.mark)
                  setMessage(null)
                  setOpen(false)
                }}
              >
                {t('common.cancel')}
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}

      {message ? (
        <p
          role={message.tone === 'err' ? 'alert' : 'status'}
          className={message.tone === 'err' ? 'mt-3 text-sm text-warn' : 'mt-3 text-sm text-success'}
        >
          {message.text}
        </p>
      ) : null}
    </Card>
  )
}
