import { Flame } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useI18n } from '../i18n/translate'
import { cleanUsername, searchProfiles, type FriendRelation, type FriendRow, type SearchHit } from '../lib/social'
import { clsx } from '../lib/utils'
import { useSocial } from '../store/social-store'
import { AvatarBadge } from './AvatarBadge'
import { Button, Field, Input, List } from './ui'

export function FriendsPanel() {
  const { t } = useI18n()
  const { friends, error, refresh, sendRequest, accept, remove } = useSocial()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [note, setNote] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const req = useRef(0)

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const cleaned = cleanUsername(query)
    if (cleaned.length < 2) {
      req.current += 1
      setHits([])
      setSearching(false)
      const trimmed = query.trim().toLowerCase()
      if (!trimmed) setNote(null)
      else if (cleaned.length === 0) setNote(t('social.usernameHint'))
      else setNote(t('social.searchShort'))
      return
    }
    const token = ++req.current
    let cancel = false
    const handle = window.setTimeout(() => {
      void (async () => {
        setSearching(true)
        setNote(null)
        const result = await searchProfiles(query)
        if (cancel || token !== req.current) return
        setSearching(false)
        setHits(result.hits)
        setNote(result.error ?? (result.hits.length === 0 ? t('social.searchEmpty') : null))
      })()
    }, 280)
    return () => {
      cancel = true
      window.clearTimeout(handle)
    }
  }, [query, t])

  const incoming = friends.filter((row) => row.relation === 'incoming')
  const outgoing = friends.filter((row) => row.relation === 'outgoing')
  const accepted = friends.filter((row) => row.relation === 'friend')
  const known = new Map(friends.map((row) => [row.userId, row.relation]))

  const add = async (id: string) => {
    if (busyId) return
    setBusyId(id)
    setBanner(null)
    const failure = await sendRequest(id)
    setBusyId(null)
    setBanner(failure ? { tone: 'err', text: failure } : { tone: 'ok', text: t('social.requestSent') })
  }

  const act = async (id: string, run: (friendshipId: string) => Promise<string | null>) => {
    if (busyId) return
    setBusyId(id)
    setBanner(null)
    const failure = await run(id)
    setBusyId(null)
    if (failure) setBanner({ tone: 'err', text: failure })
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const token = ++req.current
    const cleaned = cleanUsername(query)
    if (cleaned.length < 2) return
    void (async () => {
      setSearching(true)
      setNote(null)
      const result = await searchProfiles(query)
      if (token !== req.current) return
      setSearching(false)
      setHits(result.hits)
      setNote(result.error ?? (result.hits.length === 0 ? t('social.searchEmpty') : null))
    })()
  }

  return (
    <section className="mt-8">
      <h2 className="font-display text-2xl">{t('social.friends')}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{t('social.friendsLead')}</p>
      <p className="mt-1 text-xs leading-5 text-muted">{t('social.allSubjects')}</p>

      <form className="mt-4 flex items-end gap-2" onSubmit={submit}>
        <div className="min-w-0 flex-1">
          <Field label={t('social.username')}>
            <Input
              value={query}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
              placeholder={t('social.searchPlaceholder')}
              onChange={(event) => {
                setQuery(event.target.value)
                setBanner(null)
              }}
            />
          </Field>
        </div>
        <Button className="shrink-0" type="submit" disabled={searching || cleanUsername(query).length < 2}>
          {t('social.find')}
        </Button>
      </form>
      {note ? <p className="mt-2 text-sm text-muted">{note}</p> : null}
      {banner ? (
        <p
          role={banner.tone === 'err' ? 'alert' : 'status'}
          className={banner.tone === 'err' ? 'mt-2 text-sm text-warn' : 'mt-2 text-sm text-success'}
        >
          {banner.text}
        </p>
      ) : null}
      {error ? (
        <div className="mt-3">
          <p role="alert" className="text-sm text-warn">{error}</p>
          <Button className="mt-3" variant="secondary" onClick={() => void refresh()}>
            {t('sync.retry')}
          </Button>
        </div>
      ) : null}

      {hits.length > 0 ? (
        <List className="mt-4">
          {hits.map((hit) => {
            const relation = known.get(hit.id)
            return (
              <div key={hit.id} className="flex items-center gap-3 px-4 py-3">
                <AvatarBadge avatar={hit.avatar} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">@{hit.username}</p>
                  {relation ? <p className="text-sm text-muted">{relationLabel(relation, t)}</p> : null}
                </div>
                {relation ? null : (
                  <Button className="shrink-0 px-3" disabled={busyId === hit.id} onClick={() => void add(hit.id)}>
                    {t('common.add')}
                  </Button>
                )}
              </div>
            )
          })}
        </List>
      ) : null}

      <FriendGroup title={t('social.requests')} rows={incoming} busyId={busyId} onAccept={(id) => void act(id, accept)} onRemove={(id) => void act(id, remove)} />
      <FriendGroup title={t('social.waiting')} rows={outgoing} busyId={busyId} onRemove={(id) => void act(id, remove)} />
      <FriendGroup title={accepted.length > 0 && (incoming.length > 0 || outgoing.length > 0) ? t('social.friends') : ''} rows={accepted} busyId={busyId} onRemove={(id) => void act(id, remove)} confirm />

      {friends.length === 0 && hits.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-muted">{t('social.emptyText')}</p>
      ) : null}
    </section>
  )
}

function relationLabel(relation: FriendRelation, t: (key: 'social.incoming' | 'social.outgoing' | 'social.alreadyFriend') => string): string {
  if (relation === 'incoming') return t('social.incoming')
  if (relation === 'outgoing') return t('social.outgoing')
  return t('social.alreadyFriend')
}

function FriendGroup({
  title,
  rows,
  busyId,
  confirm = false,
  onAccept,
  onRemove,
}: {
  title: string
  rows: FriendRow[]
  busyId: string | null
  confirm?: boolean
  onAccept?: (id: string) => void
  onRemove: (id: string) => void
}) {
  const { t, plural, countInline } = useI18n()
  if (rows.length === 0) return null
  return (
    <div className="mt-5">
      {title ? <h3 className="mb-2 text-sm font-semibold">{title}</h3> : null}
      <List>
        {rows.map((row) => (
          <div key={row.friendshipId} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="relative">
                <AvatarBadge avatar={row.avatar} />
                {row.relation === 'friend' && row.studiedToday ? (
                  <span className="absolute right-0 bottom-0 size-3 rounded-full border-2 border-card bg-success" title={t('social.studied')} />
                ) : null}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">@{row.username}</p>
                {row.relation === 'friend' ? (
                  <>
                    <p className="text-sm text-muted">
                      {countInline('cards', row.cards)} · {t('account.mastered')} {row.mastered} · {t('account.working')} {row.working}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
                      <span className={clsx('inline-flex items-center gap-1', row.streak > 0 && 'text-warn')}>
                        <Flame size={14} fill={row.streak > 0 ? 'currentColor' : 'none'} aria-hidden="true" />
                        {t('streak.open', { count: row.streak, days: plural('days', row.streak) })}
                      </span>
                      <span>
                        {row.pairStreak > 0
                          ? t('social.together', { days: countInline('days', row.pairStreak) })
                          : t('social.togetherNone')}
                      </span>
                      {row.streak > 0 && !row.studiedToday ? <span>{t('social.studyToday')}</span> : null}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted">
                    {row.relation === 'incoming' ? t('social.incoming') : t('social.outgoing')}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {onAccept ? (
                <Button className="flex-1 px-3 sm:flex-none" disabled={busyId === row.friendshipId} onClick={() => onAccept(row.friendshipId)}>
                  {t('social.accept')}
                </Button>
              ) : null}
              <Button
                className="flex-1 px-3 sm:flex-none"
                variant="secondary"
                disabled={busyId === row.friendshipId}
                onClick={() => {
                  if (confirm && !window.confirm(t('social.confirmRemove', { name: `@${row.username}` }))) return
                  onRemove(row.friendshipId)
                }}
              >
                {row.relation === 'incoming' ? t('social.decline') : row.relation === 'outgoing' ? t('common.cancel') : t('common.delete')}
              </Button>
            </div>
          </div>
        ))}
      </List>
    </div>
  )
}
