import { BookOpen, Check, Lightbulb, PencilLine, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isTextInputFocused } from '../../lib/keyboard'
import {
  applyCorrect,
  applyIncorrect,
  applyPreviewDone,
  BATCH_SIZE_MAX,
  buildChoices,
  cardAnswer,
  checkSpelling,
  createSession,
  shouldAdvance,
  splitCloze,
  type SessionPhase,
  type SessionRuntime,
} from '../../lib/session'
import { advanceCard, failCard } from '../../lib/srs'
import { italianSpeechText, speakItalian } from '../../lib/tts'
import { clsx } from '../../lib/utils'
import { useAppStore } from '../../store/app-store'
import type { Card } from '../../types/models'
import { SpeakButton } from '../SpeakButton'
import { SyncBadge } from '../SyncBadge'
import { Button, EmptyState, IconButton, Screen } from '../ui'
import { AccentBar } from './AccentBar'
import { ExplanationSheet } from './ExplanationSheet'
import { MultipleChoice } from './MultipleChoice'
import { SpellingInput } from './SpellingInput'

type McStatus = 'idle' | 'correct' | 'wrong'
type SpellStatus = 'idle' | 'correct' | 'wrong' | 'accent'

const PHASE_LABEL: Record<SessionPhase, string> = {
  preview: 'Фаза 1 · Знакомство',
  mc: 'Фаза 2 · Выбор',
  spell: 'Фаза 3 · Написание',
}

export function SessionView({
  cards,
  title,
  practice = false,
}: {
  cards: Card[]
  title: string
  practice?: boolean
}) {
  const navigate = useNavigate()
  const { cards: allCards, settings, updateCard } = useAppStore()
  const [runtime, setRuntime] = useState(() => createSession(cards))
  const [choices, setChoices] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [mcStatus, setMcStatus] = useState<McStatus>('idle')
  const [spellValue, setSpellValue] = useState('')
  const [spellStatus, setSpellStatus] = useState<SpellStatus>('idle')
  const [showHint, setShowHint] = useState(false)
  const [locked, setLocked] = useState(false)
  const [explain, setExplain] = useState<{ answer: string; explanation?: string } | null>(null)

  const pendingRuntimeRef = useRef<SessionRuntime | null>(null)
  const advanceTimerRef = useRef<number | null>(null)
  const explainReadyAtRef = useRef(0)

  const cardMap = useMemo(() => new Map(allCards.map((card) => [card.id, card])), [allCards])
  const current = runtime.current
  const currentCard = current ? cardMap.get(current.cardId) : undefined
  const pool = currentCard
    ? allCards.filter((card) => card.deckId === currentCard.deckId)
    : allCards

  const clearAdvanceTimer = () => {
    if (advanceTimerRef.current) {
      window.clearTimeout(advanceTimerRef.current)
      advanceTimerRef.current = null
    }
  }

  const applyRuntime = (nextRuntime: SessionRuntime) => {
    pendingRuntimeRef.current = null
    clearAdvanceTimer()
    setRuntime(nextRuntime)
    setLocked(false)
  }

  useEffect(() => {
    if (!current || !currentCard) return
    setChoices(buildChoices(currentCard, pool))
    setSelected(null)
    setMcStatus('idle')
    setSpellValue('')
    setSpellStatus('idle')
    setShowHint(false)
    setLocked(false)
    setExplain(null)
  }, [current?.cardId, current?.tier, currentCard?.id, runtime.phase])

  const answerRevealed = Boolean(locked || explain)
  const isPreview = current?.tier === 0

  useEffect(() => {
    if (!current || !currentCard || !settings.autoPlayAudio) return
    if (isPreview) {
      speakItalian(italianSpeechText(currentCard, { revealed: true }))
      return
    }
    if (answerRevealed) {
      speakItalian(italianSpeechText(currentCard, { tier: current.tier === 0 ? 1 : current.tier, revealed: true }))
      return
    }
    if (currentCard.type === 'vocab') return
    speakItalian(
      italianSpeechText(currentCard, {
        tier: current.tier === 0 ? 1 : current.tier,
        revealed: false,
      }),
    )
  }, [current?.cardId, current?.tier, currentCard?.id, settings.autoPlayAudio, answerRevealed, isPreview])

  useEffect(() => () => clearAdvanceTimer(), [])

  const goNext = (nextRuntime = runtime, immediate = false) => {
    pendingRuntimeRef.current = nextRuntime
    clearAdvanceTimer()
    const delay = immediate ? 0 : nextRuntime.current ? (settings.autoPlayAudio ? 1100 : 650) : 160
    advanceTimerRef.current = window.setTimeout(() => applyRuntime(nextRuntime), delay)
  }

  const persistFail = (card: Card) => {
    if (!practice) updateCard(failCard(card))
  }

  const persistPass = (card: Card) => {
    if (!practice) updateCard(advanceCard(card))
  }

  const failAndExplain = (card: Card) => {
    navigator.vibrate?.(40)
    if (!runtime.failedIds.includes(card.id)) persistFail(card)
    explainReadyAtRef.current = performance.now() + 550
    setExplain({ answer: cardAnswer(card), explanation: card.explanation })
  }

  const explainReady = () => performance.now() >= explainReadyAtRef.current

  const onPreviewContinue = () => {
    applyRuntime(applyPreviewDone(runtime))
  }

  const onMcSelect = (option: string) => {
    if (!current || !currentCard || locked || current.tier !== 1) return
    setLocked(true)
    setSelected(option)
    const ok = option === cardAnswer(currentCard)
    setMcStatus(ok ? 'correct' : 'wrong')
    if (ok) {
      navigator.vibrate?.(12)
      goNext(applyCorrect(runtime))
      return
    }
    failAndExplain(currentCard)
  }

  const onSpellSubmit = () => {
    if (!current || !currentCard || locked || current.tier !== 2) return
    const result = checkSpelling(spellValue, cardAnswer(currentCard))
    if (result === 'accent') {
      setSpellStatus('accent')
      return
    }
    setLocked(true)
    if (result === 'exact') {
      navigator.vibrate?.(12)
      setSpellStatus('correct')
      // Advance SRS only if MC was clean and this spelling is the first fail-free finish
      if (shouldAdvance(runtime, current.cardId)) persistPass(currentCard)
      goNext(applyCorrect(runtime))
      return
    }
    setSpellStatus('wrong')
    failAndExplain(currentCard)
  }

  const continueAfterError = () => {
    if (!explainReady()) return
    setExplain(null)
    applyRuntime(applyIncorrect(runtime))
  }

  const flushAdvance = () => {
    if (explain) {
      if (!explainReady()) return true
      continueAfterError()
      return true
    }
    if (pendingRuntimeRef.current) {
      applyRuntime(pendingRuntimeRef.current)
      return true
    }
    return false
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        if (runtime.status === 'complete') {
          event.preventDefault()
          navigate(-1)
          return
        }
        if (isPreview && !locked) {
          event.preventDefault()
          onPreviewContinue()
          return
        }
        if (explain) {
          event.preventDefault()
          event.stopPropagation()
          flushAdvance()
          return
        }
        if (flushAdvance()) {
          event.preventDefault()
          return
        }
        if (isTextInputFocused()) return
        if (current?.tier === 2 && !locked) {
          event.preventDefault()
          onSpellSubmit()
        }
        return
      }

      if (isTextInputFocused()) return

      if (event.key === ' ' || event.code === 'Space') {
        if (!current || !currentCard) return
        const phrase = italianSpeechText(currentCard, {
          tier: current.tier === 0 ? 2 : current.tier,
          revealed: Boolean(isPreview || locked || explain),
        })
        if (!phrase) return
        event.preventDefault()
        speakItalian(phrase)
        return
      }

      if (current?.tier !== 1 || locked || explain) return
      const index = Number(event.key) - 1
      if (index >= 0 && index < choices.length) {
        event.preventDefault()
        onMcSelect(choices[index])
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (runtime.status === 'empty') {
    return (
      <Screen>
        <SessionChrome title={title} progress="0 / 0" onExit={() => navigate(-1)} />
        <div className="flex flex-1 items-center px-4 pb-[env(safe-area-inset-bottom)]">
          <EmptyState
            title="Нечего повторять"
            text="На сегодня карточек нет. Добавьте слова или грамматику — или откройте практику."
            action={<Button onClick={() => navigate('/')}>К колодам</Button>}
          />
        </div>
      </Screen>
    )
  }

  if (runtime.status === 'complete') {
    return (
      <Screen>
        <SessionChrome title={title} progress={`${runtime.total} / ${runtime.total}`} onExit={() => navigate(-1)} />
        <div className="flex flex-1 flex-col justify-center px-5 pb-[env(safe-area-inset-bottom)]">
          <div className="animate-rise rounded-3xl border border-line bg-card px-6 py-10 text-center shadow-[var(--shadow)]">
            <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-success-soft text-success">
              <Check size={30} />
            </div>
            <h1 className="font-display text-3xl">Сессия завершена</h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              Батч из {runtime.total} {pluralCards(runtime.total)}
              {practice ? ' в практике.' : '.'} За раз берём {BATCH_SIZE_MAX} карточек максимум.
              {runtime.failedIds.length > 0
                ? ` Ошибок: ${runtime.failedIds.length} — без повышения стадии, вернутся завтра.`
                : ' Все прошли выбор и написание.'}
            </p>
            <Button className="mt-8 w-full" onClick={() => navigate(-1)}>
              Готово
            </Button>
          </div>
        </div>
      </Screen>
    )
  }

  if (!current || !currentCard) return null

  const done = runtime.completedIds.length
  const answer = cardAnswer(currentCard)
  const testTier: 1 | 2 = current.tier === 2 ? 2 : 1

  if (isPreview) {
    return (
      <Screen>
        <SessionChrome
          title={title}
          progress={`${done} / ${runtime.total}`}
          ratio={runtime.total ? done / runtime.total : 0}
          phase={PHASE_LABEL.preview}
          onExit={() => navigate(-1)}
        />
        <PreviewCard card={currentCard} onContinue={onPreviewContinue} />
      </Screen>
    )
  }

  return (
    <Screen>
      <SessionChrome
        title={title}
        progress={`${done} / ${runtime.total}`}
        ratio={runtime.total ? done / runtime.total : 0}
        phase={PHASE_LABEL[runtime.phase]}
        onExit={() => navigate(-1)}
      />

      <div className="flex flex-1 flex-col px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-2">
        <div className="mb-6 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          <span className="inline-flex items-center gap-1.5">
            {current.tier === 1 ? <Check size={14} /> : <PencilLine size={14} />}
            {current.tier === 1 ? 'Выбор' : 'Написание'}
          </span>
          {practice ? <span className="rounded-full bg-surface px-2 py-1">Практика</span> : null}
        </div>

        <CardPrompt
          card={currentCard}
          tier={testTier}
          value={spellValue}
          status={spellStatus}
          locked={locked}
          revealed={answerRevealed}
          onChange={setSpellValue}
          onSubmit={onSpellSubmit}
        />

        {currentCard.notes ? (
          <button
            type="button"
            onClick={() => setShowHint((value) => !value)}
            className="mt-3 inline-flex items-center gap-1.5 self-start text-sm font-medium text-accent"
          >
            <Lightbulb size={16} />
            {showHint ? currentCard.notes : 'Подсказка'}
          </button>
        ) : null}

        <div className="mt-8 flex-1">
          {current.tier === 1 ? (
            <MultipleChoice
              options={choices}
              correct={answer}
              disabled={locked}
              selected={selected}
              status={mcStatus}
              onSelect={onMcSelect}
            />
          ) : currentCard.type === 'cloze' ? (
            <Button className="w-full" disabled={locked || !spellValue.trim()} onClick={onSpellSubmit}>
              Проверить
            </Button>
          ) : (
            <SpellingInput
              value={spellValue}
              status={spellStatus}
              disabled={locked}
              expected={answer}
              onChange={(value) => {
                setSpellValue(value)
                if (spellStatus !== 'idle') setSpellStatus('idle')
              }}
              onSubmit={onSpellSubmit}
            />
          )}
        </div>
      </div>

      {current.tier === 2 ? <AccentBar /> : null}
      {explain ? (
        <ExplanationSheet
          answer={explain.answer}
          explanation={explain.explanation}
          onContinue={continueAfterError}
        />
      ) : null}
    </Screen>
  )
}

function PreviewCard({ card, onContinue }: { card: Card; onContinue: () => void }) {
  const italian = (card.term || card.target || '').trim()
  const russian = (card.translation || '').trim()
  const hint = card.notes?.trim() || undefined

  return (
    <div className="flex flex-1 flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
      <p className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
        <BookOpen size={14} />
        Слово
      </p>

      <div className="flex flex-1 flex-col justify-center">
        <div className="animate-rise text-center">
          <div className="flex items-center justify-center gap-3">
            <h1 className="font-display text-[2.75rem] leading-tight text-fg">{italian}</h1>
            <SpeakButton text={italian} className="size-11 rounded-2xl bg-surface" />
          </div>
          {russian ? (
            <p className="mt-5 font-display text-2xl leading-snug text-accent">{russian}</p>
          ) : null}
          {hint ? (
            <p className="mx-auto mt-6 max-w-sm flex gap-2 text-left text-sm leading-6 text-muted">
              <Lightbulb size={16} className="mt-0.5 shrink-0 text-warn" />
              <span>{hint}</span>
            </p>
          ) : null}
        </div>
      </div>

      <Button className="mt-8 w-full" onClick={onContinue}>
        Запомнил, дальше
      </Button>
    </div>
  )
}

function CardPrompt({
  card,
  tier,
  value,
  status,
  locked,
  revealed,
  onChange,
  onSubmit,
}: {
  card: Card
  tier: 1 | 2
  value: string
  status: SpellStatus
  locked: boolean
  revealed: boolean
  onChange: (value: string) => void
  onSubmit: () => void
}) {
  const speech = italianSpeechText(card, { tier, revealed })

  if (card.type === 'cloze' && card.sentence) {
    const [before, after] = splitCloze(card.sentence)
    return (
      <div>
        <p className="text-sm text-muted">Вставьте форму{card.term ? ` · ${card.term}` : ''}</p>
        <div className="mt-2 flex items-start gap-2">
          <h1 className="min-w-0 flex-1 font-display text-[1.7rem] leading-snug">
            {before}
            {tier === 2 ? (
              <input
                value={value}
                disabled={locked}
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    event.stopPropagation()
                    if (!locked) onSubmit()
                  }
                }}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                className={clsx(
                  'mx-1 inline-block min-w-[6ch] border-b-2 bg-transparent px-1 text-center outline-none',
                  status === 'wrong' && 'border-danger text-danger animate-shake',
                  status === 'correct' && 'border-success text-success',
                  status === 'accent' && 'border-warn text-warn',
                  status === 'idle' && 'border-accent text-fg',
                )}
              />
            ) : (
              <span className="mx-1 inline-block min-w-[5ch] border-b-2 border-accent text-accent">____</span>
            )}
            {after}
          </h1>
          {speech ? <SpeakButton text={speech} /> : null}
        </div>
        {status === 'accent' ? (
          <p className="mt-2 text-sm text-warn">Почти! Проверьте ударения.</p>
        ) : null}
      </div>
    )
  }

  if (card.type === 'transform') {
    return (
      <div>
        <p className="text-sm text-muted">Преобразуйте</p>
        <div className="mt-1 flex items-start gap-2">
          <h1 className="min-w-0 flex-1 font-display text-[2rem] leading-tight">{card.term}</h1>
          {speech ? <SpeakButton text={speech} /> : null}
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="text-sm text-muted">Как сказать</p>
      <div className="mt-1 flex items-start gap-2">
        <h1 className="min-w-0 flex-1 font-display text-[2.1rem] leading-tight">{card.translation}</h1>
        {speech ? <SpeakButton text={speech} /> : null}
      </div>
    </div>
  )
}

function SessionChrome({
  title,
  progress,
  ratio = 0,
  phase,
  onExit,
}: {
  title: string
  progress: string
  ratio?: number
  phase?: string
  onExit: () => void
}) {
  return (
    <header className="sticky top-0 z-10 bg-bg/90 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
      <div className="flex items-center gap-2">
        <IconButton label="Выйти" onClick={onExit}>
          <X size={22} />
        </IconButton>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted">
            {phase ? `${phase} · ` : ''}
            {progress} карточек
          </p>
        </div>
        <SyncBadge />
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500"
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
    </header>
  )
}

function pluralCards(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return 'карточка'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'карточки'
  return 'карточек'
}
