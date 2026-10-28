import { Flame } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CopyPair } from '../components/CopyPair'
import { AvatarBadge } from '../components/AvatarBadge'
import { Button, Card, EmptyState, List, Page } from '../components/ui'
import {
  dismissStudent,
  ensureClassroom,
  loadClassBoard,
  type ClassDeck,
  type ClassStudent,
} from '../lib/classroom'
import { clsx } from '../lib/utils'
import { useI18n } from '../i18n/translate'
import { useSocial } from '../store/social-store'

export function ClassPage() {
  const { t, plural, countInline } = useI18n()
  const { profile, ready, unavailable } = useSocial()
  const [code, setCode] = useState<string | null>(null)
  const [students, setStudents] = useState<ClassStudent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [loadedTeacher, setLoadedTeacher] = useState<string | null>(null)
  const teacherId = ready && profile?.role === 'teacher' ? profile.id : null
  const loading = Boolean(teacherId && loadedTeacher !== teacherId)

  useEffect(() => {
    if (!teacherId) return
    let cancel = false
    void (async () => {
      const [room, board] = await Promise.all([ensureClassroom(), loadClassBoard()])
      if (cancel) return
      setCode(room.code)
      setStudents(board.students)
      setError(room.error ?? board.error)
      setLoadedTeacher(teacherId)
    })()
    return () => {
      cancel = true
    }
  }, [teacherId])

  const remove = async (student: ClassStudent) => {
    if (busyId) return
    if (!window.confirm(t('class.confirmRemove', { name: student.username }))) return
    setBusyId(student.studentId)
    const failure = await dismissStudent(student.studentId)
    setBusyId(null)
    if (failure) {
      setError(failure)
      return
    }
    setStudents((current) => current.filter((item) => item.studentId !== student.studentId))
  }

  if (!ready || loading) {
    return (
      <Page>
        <p className="text-sm text-muted">{t('common.loading')}</p>
      </Page>
    )
  }

  if (unavailable) {
    return (
      <Page>
        <EmptyState title={t('class.title')} text={t('class.unavailable')} />
      </Page>
    )
  }

  if (profile?.role !== 'teacher') {
    return (
      <Page>
        <EmptyState title={t('class.title')} text={t('class.notTeacher')} action={<Link to="/">{t('common.back')}</Link>} />
      </Page>
    )
  }

  return (
    <Page>
      <header className="mb-6 pt-2">
        <h1 className="font-display text-3xl lg:text-4xl">{t('class.title')}</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted">{t('class.lead')}</p>
      </header>

      <Card className="px-4 py-4">
        <h2 className="text-sm font-semibold">{t('class.invite')}</h2>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        {code ? (
          <div className="mt-4">
            <CopyPair code={code} path={`/join/${code}`} />
          </div>
        ) : null}
      </Card>

      {students.length === 0 ? (
        <div className="mt-6">
          <EmptyState title={t('class.emptyTitle')} text={t('class.emptyText')} />
        </div>
      ) : (
        <List className="mt-6">
          {students.map((student) => {
            const open = openId === student.studentId
            return (
              <div key={student.studentId} className="px-4 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => setOpenId(open ? null : student.studentId)}
                  >
                    <span className="relative">
                      <AvatarBadge avatar={student.avatar} />
                      {student.studiedToday ? (
                        <span
                          className="absolute right-0 bottom-0 size-3 rounded-full border-2 border-card bg-success"
                          title={t('social.studied')}
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">@{student.username}</span>
                      <span className="mt-0.5 block text-sm text-muted">
                        {countInline('cards', student.cards)} · {t('account.mastered')} {student.mastered} ·{' '}
                        {t('account.working')} {student.working}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
                        <span className={clsx('inline-flex items-center gap-1', student.streak > 0 && 'text-warn')}>
                          <Flame size={14} fill={student.streak > 0 ? 'currentColor' : 'none'} aria-hidden="true" />
                          {t('streak.open', { count: student.streak, days: plural('days', student.streak) })}
                        </span>
                        {student.streak > 0 && !student.studiedToday ? <span>{t('social.studyToday')}</span> : null}
                      </span>
                    </span>
                  </button>
                  <Button
                    className="shrink-0 px-3 sm:self-center"
                    variant="secondary"
                    disabled={busyId === student.studentId}
                    onClick={() => void remove(student)}
                  >
                    {t('class.remove')}
                  </Button>
                </div>
                {open ? <DeckList decks={student.decks} /> : null}
              </div>
            )
          })}
        </List>
      )}
    </Page>
  )
}

function DeckList({ decks }: { decks: ClassDeck[] }) {
  const { t } = useI18n()
  if (decks.length === 0) {
    return <p className="mt-3 text-sm text-muted">{t('class.noDecks')}</p>
  }
  return (
    <div className="mt-3 space-y-2 border-t border-line pt-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t('class.decks')}</p>
      {decks.map((deck) => (
        <div key={deck.id} className="rounded-2xl bg-surface px-3 py-2.5">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-semibold">{deck.title}</p>
            <span className="shrink-0 text-xs text-muted">
              {deck.kind === 'exercise' ? t('share.kindExercise') : t('share.kindDeck')}
              {' · '}
              {deck.shared ? t('class.shared') : t('class.own')}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            {deck.fresh} {t('class.fresh')} · {deck.learning} {t('class.learning')} · {deck.mastered}{' '}
            {t('account.mastered')}
          </p>
          <StageBar deck={deck} />
        </div>
      ))}
    </div>
  )
}

function StageBar({ deck }: { deck: ClassDeck }) {
  if (deck.total <= 0) return null
  const width = (count: number) => `${(count / deck.total) * 100}%`
  return (
    <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-card">
      <span className="bg-success" style={{ width: width(deck.mastered) }} />
      <span className="bg-accent" style={{ width: width(deck.learning) }} />
    </div>
  )
}
