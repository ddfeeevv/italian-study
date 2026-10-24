import { Check, ChevronDown, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, Field, Input, Sheet } from './ui'
import { t as translate, useI18n } from '../i18n/translate'
import { LANGUAGE_PRESETS } from '../lib/subjects'
import { clsx } from '../lib/utils'
import { useAppStore } from '../store/app-store'
import type { Subject } from '../types/models'

export function SubjectSwitcher({ wide = false }: { wide?: boolean }) {
  const { t, studyTitle } = useI18n()
  const { subjects, activeSubject, addLanguage, addTopic, setActiveSubject, deleteSubject } = useAppStore()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const titleOf = (subject: Subject) => studyTitle(subject.presetId, subject.title)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'list' | 'language' | 'topic'>('list')
  const [title, setTitle] = useState('')

  const close = () => {
    setOpen(false)
    setMode('list')
    setTitle('')
  }

  const goHome = () => {
    if (pathname !== '/') navigate('/', { replace: true })
  }

  const choose = (subjectId: string, presetId: string | null) => {
    const currentId = activeSubject?.id
    if (presetId) addLanguage(presetId)
    else setActiveSubject(subjectId)
    close()
    if (subjectId !== currentId) goHome()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={clsx(
          'flex min-h-11 items-center gap-1.5 rounded-2xl text-left transition hover:bg-surface',
          wide ? 'w-full px-3' : 'max-w-full px-1',
        )}
      >
        <span className={clsx('truncate font-display leading-tight', wide ? 'text-xl' : 'text-lg')}>
          {activeSubject ? titleOf(activeSubject) : t('subject.fallback')}
        </span>
        <ChevronDown size={16} className="shrink-0 text-muted" />
      </button>

      {open ? (
        <Sheet onClose={close}>
          {mode === 'list' ? (
            <>
              <h2 className="font-display text-2xl">{t('subject.title')}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{t('subject.lead')}</p>
              <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto">
                {subjects.map((subject) => (
                  <li key={subject.id}>
                    <SubjectRow
                      title={titleOf(subject)}
                      selected={subject.id === activeSubject?.id}
                      onSelect={() => choose(subject.id, subject.presetId)}
                      onDelete={
                        subjects.length > 1
                          ? () => {
                              const ok = window.confirm(t('subject.delete', { title: titleOf(subject) }))
                              if (!ok) return
                              const removingActive = subject.id === activeSubject?.id
                              deleteSubject(subject.id)
                              if (removingActive) {
                                close()
                                goHome()
                              }
                            }
                          : undefined
                      }
                    />
                  </li>
                ))}
              </ul>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button variant="secondary" onClick={() => setMode('language')}>
                  <Plus size={16} />
                  {t('subject.language')}
                </Button>
                <Button variant="secondary" onClick={() => setMode('topic')}>
                  <Plus size={16} />
                  {t('subject.topic')}
                </Button>
              </div>
            </>
          ) : null}

          {mode === 'language' ? (
            <>
              <h2 className="font-display text-2xl">{t('subject.languageTitle')}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{t('subject.languageLead')}</p>
              <ul className="mt-4 grid max-h-80 grid-cols-2 gap-2 overflow-y-auto">
                {LANGUAGE_PRESETS.map((preset) => {
                  const existing = subjects.some((subject) => subject.presetId === preset.id)
                  return (
                    <li key={preset.id}>
                      <button
                        type="button"
                        onClick={() => {
                          const next = addLanguage(preset.id)
                          close()
                          if (next && next.id !== activeSubject?.id) goHome()
                        }}
                        className={clsx(
                          'flex min-h-12 w-full items-center justify-between gap-2 rounded-2xl border px-3 text-left text-sm font-semibold',
                          existing ? 'border-accent bg-surface text-accent' : 'border-line bg-card text-fg',
                        )}
                      >
                        <span className="truncate">{studyTitle(preset.id, preset.title)}</span>
                        {existing ? <Check size={16} /> : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
              <Button variant="secondary" className="mt-4 w-full" onClick={() => setMode('list')}>
                {t('common.back')}
              </Button>
            </>
          ) : null}

          {mode === 'topic' ? (
            <>
              <h2 className="font-display text-2xl">{t('subject.topicTitle')}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{t('subject.topicLead')}</p>
              <form
                className="mt-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (!title.trim()) return
                  const created = addTopic(title)
                  close()
                  if (created) goHome()
                }}
              >
                <Field label={t('subject.name')}>
                  <Input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder={t('subject.placeholder')}
                    autoFocus
                  />
                </Field>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Button variant="secondary" type="button" onClick={() => setMode('list')}>
                    {t('common.back')}
                  </Button>
                  <Button type="submit" disabled={!title.trim()}>
                    {t('common.create')}
                  </Button>
                </div>
              </form>
            </>
          ) : null}
        </Sheet>
      ) : null}
    </>
  )
}

function SubjectRow({
  title,
  selected,
  onSelect,
  onDelete,
}: {
  title: string
  selected: boolean
  onSelect: () => void
  onDelete?: () => void
}) {
  return (
    <div
      className={clsx(
        'flex min-h-12 items-center gap-2 rounded-2xl border px-3',
        selected ? 'border-accent bg-surface' : 'border-line',
      )}
    >
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left">
        <span className="truncate font-semibold">{title}</span>
        {selected ? <Check size={16} className="shrink-0 text-accent" /> : null}
      </button>
      {onDelete ? (
        <button
          type="button"
          aria-label={translate('subject.deleteAria', { title })}
          onClick={onDelete}
          className="text-muted hover:text-danger"
        >
          <Trash2 size={16} />
        </button>
      ) : null}
    </div>
  )
}
