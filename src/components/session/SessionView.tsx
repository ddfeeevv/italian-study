import { BookOpen, Check, ChevronLeft, ChevronRight, Lightbulb, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isTextInputFocused } from '../../lib/keyboard'
import {
  applyCorrect,
  applyExamMiss,
  applyIncorrect,
  applyMoveOn,
  applyPreviewDone,
  BATCH_SIZE_MAX,
  buildChoices,
  cardAnswer,
  sameKindPool,
  checkSpelling,
  createSession,
  shouldAdvance,
  splitCloze,
  type SessionPhase,
  type QueueItem,
  type SessionRuntime,
} from '../../lib/session'
import { advanceCard, failCard, intervalDaysForStage, normalizeIntervals, reviewInDays } from '../../lib/srs'
import { useI18n, t } from '../../i18n/translate'
import { speechText, speak } from '../../lib/tts'
import { productionProfile, subjectSpeech } from '../../lib/subjects'
import { clsx } from '../../lib/utils'
import { useAppStore } from '../../store/app-store'
import { useStreak } from '../../store/streak-store'
import type { Card } from '../../types/models'
import { Mascot } from '../Mascot'
import { StreakCompleteLine } from '../StreakCard'
import { SpeakButton } from '../SpeakButton'
import { SyncBadge } from '../SyncBadge'
import { Button, Card as Panel, EmptyState, IconButton, Screen } from '../ui'
import { AccentBar } from './AccentBar'
import { ExplanationSheet } from './ExplanationSheet'
import { MultipleChoice } from './MultipleChoice'
import { SpellingInput } from './SpellingInput'

type McStatus = 'idle' | 'correct' | 'wrong'
type SpellStatus = 'idle' | 'correct' | 'wrong' | 'accent'

function phaseLabel(phase: SessionPhase, hasPreview: boolean): string {
  if (hasPreview) {
    if (phase === 'preview') return t('session.phasePreview')
    if (phase === 'mc') return t('session.phaseChoice')
    return t('session.phaseSpell')
  }
  if (phase === 'spell') return t('session.phaseSpell2')
  return t('session.phaseChoice2')
}

export function SessionView({
  cards,
  title,
  practice = false,
  kind = 'vocab',
  exam = false,
  limit,
  exitTo,
}: {
  cards: Card[]
  title: string
  practice?: boolean
  kind?: 'vocab' | 'exercise'
  exam?: boolean
  limit?: number
  exitTo?: string
}) {
  const { plural, countInline } = useI18n()
  const navigate = useNavigate()
  const leave = () => {
    if (exitTo) navigate(exitTo)
    else navigate(-1)
  }
  const { cards: allCards, decks, subjects, activeSubject, settings, updateCard } = useAppStore()
  const { markStudied } = useStreak()
  const [runtime, setRuntime] = useState(() =>
    createSession(cards, exam ? { limit, skipPreview: true } : { takeAll: kind === 'exercise' }),
  )
  const [choices, setChoices] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [mcStatus, setMcStatus] = useState<McStatus>('idle')
  const [spellValue, setSpellValue] = useState('')
  const [spellStatus, setSpellStatus] = useState<SpellStatus>('idle')
  const [showHint, setShowHint] = useState(false)
  const [locked, setLocked] = useState(false)
  const [explain, setExplain] = useState<{ answer: string; explanation?: string } | null>(null)
  const [canPreviewBack, setCanPreviewBack] = useState(false)
  const [previewGate, setPreviewGate] = useState(false)
  const [freeRepeat, setFreeRepeat] = useState(false)

  const pendingRuntimeRef = useRef<SessionRuntime | null>(null)
  const runtimeRef = useRef(runtime)
  const previewSeenRef = useRef<QueueItem[]>([])
  const advanceTimerRef = useRef<number | null>(null)
  const explainReadyAtRef = useRef(0)
  const isMountedRef = useRef(true)

  const cardMap = useMemo(() => new Map(allCards.map((card) => [card.id, card])), [allCards])
  const current = runtime.current
  const currentCard = current ? cardMap.get(current.cardId) : undefined
  const cardDeck = currentCard ? decks.find((deck) => deck.id === currentCard.deckId) : undefined
  const cardSubject = subjects.find((subject) => subject.id === cardDeck?.subjectId) ?? activeSubject
  const speech = subjectSpeech(cardSubject)
  const profile = useMemo(() => productionProfile(cardSubject), [cardSubject])
  const pool = currentCard
    ? allCards.filter((card) => card.deckId === currentCard.deckId)
    : allCards
  const subjectPool = currentCard ? sameKindPool(currentCard, allCards, decks) : allCards

  const clearAdvanceTimer = () => {
    if (advanceTimerRef.current) {
      window.clearTimeout(advanceTimerRef.current)
      advanceTimerRef.current = null
    }
  }

  const applyRuntime = (nextRuntime: SessionRuntime) => {
    if (!isMountedRef.current) return
    pendingRuntimeRef.current = null
    clearAdvanceTimer()
    runtimeRef.current = nextRuntime
    setRuntime(nextRuntime)
    setLocked(false)
  }

  useEffect(() => {
    if (!current || !currentCard) return
    setChoices(buildChoices(currentCard, pool, subjectPool, profile))
    setSelected(null)
    setMcStatus('idle')
    setSpellValue('')
    setSpellStatus('idle')
    setShowHint(false)
    setLocked(false)
    setExplain(null)
  }, [current?.cardId, current?.tier, currentCard?.id, profile, runtime.phase])

  const answerRevealed = Boolean(locked || explain)
  const isPreview = current?.tier === 0

  useEffect(() => {
    if (!current || !currentCard || !settings.autoPlayAudio || !speech.locale) return
    if (isPreview) {
      speak(speechText(currentCard, { revealed: true }), speech.locale)
      return
    }
    if (answerRevealed) {
      speak(speechText(currentCard, { tier: current.tier === 0 ? 1 : current.tier, revealed: true }), speech.locale)
      return
    }
    if (currentCard.type === 'vocab') return
    speak(
      speechText(currentCard, {
        tier: current.tier === 0 ? 1 : current.tier,
        revealed: false,
      }),
      speech.locale,
    )
  }, [current?.cardId, current?.tier, currentCard?.id, settings.autoPlayAudio, answerRevealed, isPreview, speech.locale])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      clearAdvanceTimer()
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const goNext = (nextRuntime = runtime, immediate = false) => {
    pendingRuntimeRef.current = nextRuntime
    clearAdvanceTimer()
    const delay = immediate ? 0 : nextRuntime.current ? (settings.autoPlayAudio ? 1100 : 650) : 160
    advanceTimerRef.current = window.setTimeout(() => applyRuntime(nextRuntime), delay)
  }

  const intervals = normalizeIntervals(settings.intervals)
  const schedules = !practice && !freeRepeat

  const persistFail = (card: Card) => {
    if (!schedules) return
    updateCard(failCard(card, new Date(), intervals))
  }

  const persistPass = (card: Card) => {
    if (!schedules) return
    updateCard(advanceCard(card, new Date(), intervals))
  }

  const failAndExplain = (card: Card) => {
    navigator.vibrate?.(40)
    if (!runtime.failedIds.includes(card.id)) persistFail(card)
    explainReadyAtRef.current = performance.now() + 550
    setExplain({ answer: cardAnswer(card), explanation: card.explanation })
  }

  const explainReady = () => performance.now() >= explainReadyAtRef.current

  const finishPreviewCard = () => {
    const rt = runtimeRef.current
    if (!rt.current || rt.current.tier !== 0) return
    previewSeenRef.current = [...previewSeenRef.current, rt.current]
    setCanPreviewBack(true)
    setPreviewGate(false)
    applyRuntime(applyPreviewDone(rt))
  }

  const onPreviewContinue = () => {
    const rt = runtimeRef.current
    if (!rt.current || rt.current.tier !== 0) return
    if (rt.queue.length === 0) {
      setPreviewGate(true)
      return
    }
    finishPreviewCard()
  }

  const confirmPreviewEnd = () => {
    const rt = runtimeRef.current
    if (!rt.current || rt.current.tier !== 0 || rt.queue.length > 0) {
      setPreviewGate(false)
      return
    }
    finishPreviewCard()
  }

  const onPreviewBack = () => {
    setPreviewGate(false)
    const rt = runtimeRef.current
    const seen = previewSeenRef.current
    if (!rt.current || rt.current.tier !== 0 || seen.length === 0) return
    const previous = seen[seen.length - 1]
    const item = rt.current
    previewSeenRef.current = seen.slice(0, -1)
    setCanPreviewBack(previewSeenRef.current.length > 0)
    applyRuntime({
      ...rt,
      phase: 'preview',
      status: 'active',
      current: previous,
      queue: [item, ...rt.queue],
    })
  }

  const onMcSelect = (option: string) => {
    if (!current || !currentCard || locked || current.tier !== 1) return
    setLocked(true)
    markStudied(current.cardId)
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
    const result = checkSpelling(spellValue, cardAnswer(currentCard), speech.locale)
    if (result === 'accent') {
      setSpellStatus('accent')
      return
    }
    setLocked(true)
    markStudied(current.cardId)
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
    applyRuntime(exam ? applyExamMiss(runtime) : applyMoveOn(runtime))
  }

  const againAfterError = () => {
    if (!explainReady()) return
    setExplain(null)
    applyRuntime(applyIncorrect(runtime))
  }

  const restartBatch = () => {
    const batch = runtime.batchIds
      .map((id) => cardMap.get(id))
      .filter((card): card is Card => Boolean(card))
    if (batch.length === 0) return
    setFreeRepeat(true)
    previewSeenRef.current = []
    setCanPreviewBack(false)
    setPreviewGate(false)
    applyRuntime(createSession(batch, { takeAll: true, skipPreview: true }))
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
      if (event.key === 'Escape' && previewGate) {
        event.preventDefault()
        setPreviewGate(false)
        return
      }

      if (event.key === 'Enter') {
        if (previewGate) {
          event.preventDefault()
          confirmPreviewEnd()
          return
        }
        if (runtime.status === 'complete') {
          event.preventDefault()
          leave()
          return
        }
        if (isPreview && !locked) {
          event.preventDefault()
          onPreviewContinue()
          return
        }
        if (explain) {
          if (isTextInputFocused()) return
          event.preventDefault()
          event.stopPropagation()
          if (exam) continueAfterError()
          else againAfterError()
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

      if (isPreview && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault()
        if (previewGate && event.key === 'ArrowRight') return
        if (event.key === 'ArrowLeft') onPreviewBack()
        else onPreviewContinue()
        return
      }

      if (event.key === ' ' || event.code === 'Space') {
        if (!current || !currentCard) return
        const phrase = speechText(currentCard, {
          tier: current.tier === 0 ? 2 : current.tier,
          revealed: Boolean(isPreview || locked || explain),
        })
        if (!phrase || !speech.locale) return
        event.preventDefault()
        speak(phrase, speech.locale)
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

  const unit = plural(exam ? 'questions' : kind === 'exercise' ? 'tasks' : 'cards', runtime.total)

  if (runtime.status === 'empty') {
    return (
      <Screen>
        <SessionChrome title={title} progress="0 / 0" unit={unit} onExit={leave} />
        <div className="mx-auto flex w-full max-w-lg flex-1 items-center px-4 pb-[env(safe-area-inset-bottom)] lg:px-8">
          <EmptyState
            title={exam ? t('session.nothingAsk') : t('session.nothingReview')}
            text={
              exam
                ? t('session.noQuestions')
                : kind === 'exercise'
                  ? t('session.noTasks')
                  : t('session.noWordsToday')
            }
            action={
              <Button onClick={() => navigate(exam ? '/exam' : kind === 'exercise' ? '/exercises' : '/')}>
                {exam ? t('session.toSetup') : kind === 'exercise' ? t('session.toExercises') : t('session.toDecks')}
              </Button>
            }
          />
        </div>
      </Screen>
    )
  }

  if (runtime.status === 'complete' && exam) {
    return <ExamComplete runtime={runtime} cardMap={cardMap} onDone={leave} />
  }

  if (runtime.status === 'complete') {
    return (
      <Screen>
        <SessionChrome
          title={title}
          progress={`${runtime.total} / ${runtime.total}`}
          unit={unit}
          onExit={leave}
        />
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 pb-[env(safe-area-inset-bottom)] lg:px-8">
          <div className="animate-rise rounded-3xl border border-line bg-card px-6 py-10 text-center shadow-[var(--shadow)] lg:px-10 lg:py-14">
            <Mascot className="mx-auto mb-4" />
            <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-success-soft text-success">
              <Check size={30} />
            </div>
            <h1 className="font-display text-3xl">{t('session.complete')}</h1>
            <StreakCompleteLine />
            <p className="mt-3 text-sm leading-6 text-muted">
              {kind === 'exercise' ? (
                <>
                  {t('session.drillDone', { items: countInline('tasks', runtime.total) })}
                  {runtime.failedIds.length > 0 ? ` ${t('session.drillErrors', { count: runtime.failedIds.length })}` : ''}
                </>
              ) : (
                <>
                  {t('session.batch', {
                    items: countInline('cards', runtime.total),
                    maxItems: countInline('cards', BATCH_SIZE_MAX),
                  })}{' '}
                  {runtime.failedIds.length > 0
                    ? t('session.batchErrors', {
                        count: runtime.failedIds.length,
                        when: countInline('days', intervalDaysForStage(0, intervals)),
                      })
                    : t('session.batchClean')}
                </>
              )}
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <Button variant="secondary" onClick={restartBatch}>
                {t('session.again')}
              </Button>
              <p className="text-xs leading-5 text-muted">{t('session.againBatch')}</p>
              <Button onClick={leave}>{t('common.done')}</Button>
            </div>
          </div>
        </div>
      </Screen>
    )
  }

  if (!current || !currentCard) return null

  const done = runtime.completedIds.length
  const examBar = exam ? examBarState(runtime) : null
  const answer = cardAnswer(currentCard)
  const testTier: 1 | 2 = current.tier === 2 ? 2 : 1

  if (isPreview) {
    return (
      <Screen>
        <SessionChrome
          title={title}
          progress={`${done} / ${runtime.total}`}
          ratio={runtime.total ? done / runtime.total : 0}
          phase={t('session.phasePreview')}
          unit={plural('cards', runtime.total)}
          onExit={leave}
        />
        <PreviewCard
          card={currentCard}
          locale={speech.locale}
          speechLabel={speech.label}
          canGoBack={canPreviewBack}
          onBack={onPreviewBack}
          onContinue={onPreviewContinue}
        />
        {previewGate ? (
          <PreviewEndGate onConfirm={confirmPreviewEnd} onCancel={() => setPreviewGate(false)} />
        ) : null}
      </Screen>
    )
  }

  return (
    <Screen>
      <SessionChrome
        title={title}
        progress={examBar ? examBar.label : `${done} / ${runtime.total}`}
        ratio={examBar ? examBar.ratio : runtime.total ? done / runtime.total : 0}
        phase={exam ? (runtime.phase === 'spell' ? t('session.examSpell') : t('session.examChoice')) : phaseLabel(runtime.phase, runtime.hasPreview)}
        unit={unit}
        onExit={leave}
      />

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4 lg:px-8 lg:pb-28">
        <p className="mb-4 hidden text-right text-xs text-muted lg:block">
          {current.tier === 1 ? t('session.keysHint') : t('session.enterHint')} · {t('session.spaceHint')}
        </p>

        <div
          className={clsx(
            'flex flex-1 flex-col',
            currentCard.type === 'cloze' && current.tier === 2
              ? 'lg:mx-auto lg:w-full lg:max-w-3xl'
              : 'lg:grid lg:grid-cols-2 lg:items-center lg:gap-x-16',
          )}
        >
          <div>
            <CardPrompt
              card={currentCard}
              tier={testTier}
              value={spellValue}
              status={spellStatus}
              locked={locked}
              revealed={answerRevealed}
              locale={speech.locale}
              speechLabel={speech.label}
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
                {showHint ? currentCard.notes : t('common.hint')}
              </button>
            ) : null}
          </div>

          <div className={clsx('mt-8 flex-1', currentCard.type === 'cloze' && current.tier === 2 ? '' : 'lg:mt-0')}>
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
              <Button className="w-full lg:max-w-sm" disabled={locked || !spellValue.trim()} onClick={onSpellSubmit}>
                {t('common.check')}
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
      </div>

      {current.tier === 2 ? <AccentBar accents={cardSubject?.accents ?? []} /> : null}
      {explain && currentCard ? (
        <ExplanationSheet
          key={`${currentCard.id}:${current?.tier ?? 0}`}
          answer={explain.answer}
          explanation={explain.explanation}
          locale={speech.locale}
          speechLabel={speech.label}
          returnDays={schedules ? intervalDaysForStage(0, intervals) : undefined}
          onReturnDays={
            schedules
              ? (days) => {
                  const latest = cardMap.get(currentCard.id) ?? currentCard
                  updateCard(reviewInDays({ ...latest, stage: 0 }, days))
                }
              : undefined
          }
          onAgain={exam ? undefined : againAfterError}
          onContinue={continueAfterError}
        />
      ) : null}
    </Screen>
  )
}

function PreviewCard({
  card,
  locale,
  speechLabel,
  canGoBack,
  onBack,
  onContinue,
}: {
  card: Card
  locale: string | null
  speechLabel: string
  canGoBack: boolean
  onBack: () => void
  onContinue: () => void
}) {
  const { t } = useI18n()
  const term = (card.term || card.target || '').trim()
  const gloss = (card.translation || '').trim()
  const hint = card.notes?.trim() || undefined

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 lg:justify-center lg:px-8 lg:pb-16">
      <p className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
        <BookOpen size={14} />
        {t('session.previewLabel')}
      </p>

      <div className="flex flex-1 flex-col justify-center">
        <div key={card.id} className="animate-rise text-center">
          <div className="flex items-center justify-center gap-3">
            <h1 className="font-display text-[2.75rem] leading-tight text-fg lg:text-7xl">{term}</h1>
            <SpeakButton text={term} locale={locale} label={speechLabel} className="size-11 rounded-2xl bg-surface" />
          </div>
          {gloss ? (
            <p className="mt-5 font-display text-2xl leading-snug text-accent lg:text-4xl">{gloss}</p>
          ) : null}
          {hint ? (
            <p className="mx-auto mt-6 max-w-sm flex gap-2 text-left text-sm leading-6 text-muted">
              <Lightbulb size={16} className="mt-0.5 shrink-0 text-warn" />
              <span>{hint}</span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-8 flex items-center gap-3 lg:mx-auto lg:mt-12 lg:w-full lg:max-w-md">
        <Button variant="secondary" className="shrink-0 px-3.5" disabled={!canGoBack} onClick={onBack}>
          <ChevronLeft size={18} />
          {t('common.back')}
        </Button>
        <Button className="min-w-0 flex-1" onClick={onContinue}>
          {t('session.remembered')}
          <ChevronRight size={18} />
        </Button>
      </div>
      <p className="mt-3 text-center text-xs text-muted">{t('session.previewKeys')}</p>
    </div>
  )
}

function PreviewEndGate({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const { t } = useI18n()
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-6"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-end-title"
        onClick={(event) => event.stopPropagation()}
      >
        <Panel className="animate-rise rounded-b-none px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:rounded-3xl sm:pb-6">
          <h2 id="preview-end-title" className="font-display text-2xl">
            {t('session.previewEndTitle')}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">{t('session.previewEndText')}</p>
          <div className="mt-5 flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={onCancel}>
              {t('common.no')}
            </Button>
            <Button className="flex-1" onClick={onConfirm}>
              {t('common.yes')}
            </Button>
          </div>
          <p className="mt-3 text-center text-xs text-muted">{t('session.enterYes')}</p>
        </Panel>
      </div>
    </div>
  )
}

function clozePromptLabel(card: Card): string {
  const infinitive = card.term?.trim()
  const answer = (card.target || '').trim()
  // Show base form only when it is clearly not the answer itself
  if (
    infinitive &&
    answer &&
    infinitive.toLowerCase() !== answer.toLowerCase()
  ) {
    return t('session.fillWith', { base: infinitive })
  }
  return t('session.fill')
}

function CardPrompt({
  card,
  tier,
  value,
  status,
  locked,
  revealed,
  locale,
  speechLabel,
  onChange,
  onSubmit,
}: {
  card: Card
  tier: 1 | 2
  value: string
  status: SpellStatus
  locked: boolean
  revealed: boolean
  locale: string | null
  speechLabel: string
  onChange: (value: string) => void
  onSubmit: () => void
}) {
  const { t } = useI18n()
  const phrase = speechText(card, { tier, revealed })

  if (card.type === 'cloze' && card.sentence) {
    const [before, after] = splitCloze(card.sentence)
    return (
      <div>
        <p className="text-sm text-muted">{clozePromptLabel(card)}</p>
        <div className="mt-2 flex items-start gap-2">
          <h1 className="min-w-0 flex-1 font-display text-[1.7rem] leading-snug lg:text-4xl">
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
          {phrase ? <SpeakButton text={phrase} locale={locale} label={speechLabel} /> : null}
        </div>
        {status === 'accent' ? (
          <p className="mt-2 text-sm text-warn">{t('session.almost')}</p>
        ) : null}
      </div>
    )
  }

  if (card.type === 'transform') {
    return (
      <div>
        <p className="text-sm text-muted">{t('session.transform')}</p>
        <div className="mt-1 flex items-start gap-2">
          <h1 className="min-w-0 flex-1 font-display text-[2rem] leading-tight lg:text-5xl">{card.term}</h1>
          {phrase ? <SpeakButton text={phrase} locale={locale} label={speechLabel} /> : null}
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="text-sm text-muted">{t('session.howToSay')}</p>
      <div className="mt-1 flex items-start gap-2">
        <h1 className="min-w-0 flex-1 font-display text-[2.1rem] leading-tight lg:text-5xl">{card.translation}</h1>
        {phrase ? <SpeakButton text={phrase} locale={locale} label={speechLabel} /> : null}
      </div>
    </div>
  )
}

function SessionChrome({
  title,
  progress,
  ratio = 0,
  phase,
  unit,
  onExit,
}: {
  title: string
  progress: string
  ratio?: number
  phase?: string
  unit: string
  onExit: () => void
}) {
  const { t } = useI18n()
  return (
    <header className="sticky top-0 z-10 bg-bg/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
      <div className="flex items-center gap-2">
        <IconButton label={t('common.exit')} onClick={onExit}>
          <X size={22} />
        </IconButton>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted">
            {phase ? `${phase} · ` : ''}
            {progress} {unit}
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
      </div>
    </header>
  )
}

function examBarState(runtime: SessionRuntime): { label: string; ratio: number } {
  if (runtime.phase === 'spell') {
    const done = runtime.completedIds.length
    return { label: `${done} / ${runtime.total}`, ratio: runtime.total ? done / runtime.total : 0 }
  }
  const mcTotal = runtime.batchIds.length - runtime.skipMcIds.length
  const remaining = runtime.current ? runtime.queue.length + 1 : 0
  const done = Math.max(0, mcTotal - remaining)
  const total = Math.max(mcTotal, 1)
  return { label: `${done} / ${mcTotal}`, ratio: done / total }
}

function ExamComplete({
  runtime,
  cardMap,
  onDone,
}: {
  runtime: SessionRuntime
  cardMap: Map<string, Card>
  onDone: () => void
}) {
  const missed = runtime.failedIds
    .map((id) => cardMap.get(id))
    .filter((card): card is Card => Boolean(card))
  const wrong = runtime.failedIds.length
  const clean = Math.max(0, runtime.total - wrong)
  const perfect = wrong === 0
  const { plural } = useI18n()

  return (
    <Screen>
      <SessionChrome title={t('exam.title')} progress={`${runtime.total} / ${runtime.total}`} ratio={1} unit={plural('questions', runtime.total)} onExit={onDone} />
      <div
        className={clsx(
          'mx-auto flex w-full max-w-lg flex-1 flex-col overflow-y-auto px-5 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:max-w-xl lg:px-8',
          perfect && 'justify-center',
        )}
      >
        <div className="animate-rise rounded-3xl border border-line bg-card px-6 py-8 text-center shadow-[var(--shadow)]">
          <div
            className={clsx(
              'mx-auto mb-5 flex size-16 items-center justify-center rounded-full',
              perfect ? 'bg-success-soft text-success' : 'bg-warn-soft text-warn',
            )}
          >
            <Check size={30} />
          </div>
          <p className="font-display text-6xl leading-none">
            {clean}
            <span className="text-3xl text-muted">/{runtime.total}</span>
          </p>
          <h1 className="mt-3 font-display text-2xl">{t('session.perfect')}</h1>
          <StreakCompleteLine />
          <p className="mt-3 text-sm leading-6 text-muted">{t('session.examRule')}</p>
          <Button className="mt-6 w-full" onClick={onDone}>
            {t('session.toSetup')}
          </Button>
        </div>

        {missed.length > 0 ? (
          <div className="mt-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted">{t('session.misses')}</h2>
            <ul className="space-y-2">
              {missed.map((card) => {
                const row = examMissRow(card)
                return (
                  <li key={card.id} className="rounded-2xl border border-line bg-card px-4 py-3 text-left">
                    <p className="text-sm leading-6 text-muted">{row.prompt}</p>
                    <p className="mt-1 font-semibold">{row.answer}</p>
                    {card.explanation ? <p className="mt-1 text-sm leading-6 text-muted">{card.explanation}</p> : null}
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </Screen>
  )
}

function examMissRow(card: Card): { prompt: string; answer: string } {
  if (card.type === 'cloze') {
    return {
      prompt: (card.sentence ?? card.term).replace(/\{blank\}/gi, '_____'),
      answer: card.target,
    }
  }
  if (card.type === 'transform') return { prompt: card.term, answer: card.target }
  return { prompt: card.translation || card.term, answer: card.target || card.term }
}
