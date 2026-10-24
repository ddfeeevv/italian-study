import { BookOpen, Check, ChevronLeft, ChevronRight, Lightbulb, PencilLine, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isTextInputFocused } from '../../lib/keyboard'
import {
  applyCorrect,
  applyExamMiss,
  applyIncorrect,
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
import { advanceCard, failCard } from '../../lib/srs'
import { italianSpeechText, speakItalian } from '../../lib/tts'
import { clsx } from '../../lib/utils'
import { useAppStore } from '../../store/app-store'
import type { Card } from '../../types/models'
import { SpeakButton } from '../SpeakButton'
import { SyncBadge } from '../SyncBadge'
import { Button, Card as Panel, EmptyState, IconButton, Screen } from '../ui'
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

function phaseLabel(phase: SessionPhase, hasPreview: boolean): string {
  if (hasPreview) return PHASE_LABEL[phase]
  if (phase === 'spell') return 'Фаза 2 · Написание'
  return 'Фаза 1 · Выбор'
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
  const navigate = useNavigate()
  const leave = () => {
    if (exitTo) navigate(exitTo)
    else navigate(-1)
  }
  const { cards: allCards, decks, settings, updateCard } = useAppStore()
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

  const pendingRuntimeRef = useRef<SessionRuntime | null>(null)
  const runtimeRef = useRef(runtime)
  const previewSeenRef = useRef<QueueItem[]>([])
  const advanceTimerRef = useRef<number | null>(null)
  const explainReadyAtRef = useRef(0)

  const cardMap = useMemo(() => new Map(allCards.map((card) => [card.id, card])), [allCards])
  const current = runtime.current
  const currentCard = current ? cardMap.get(current.cardId) : undefined
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
    pendingRuntimeRef.current = null
    clearAdvanceTimer()
    runtimeRef.current = nextRuntime
    setRuntime(nextRuntime)
    setLocked(false)
  }

  useEffect(() => {
    if (!current || !currentCard) return
    setChoices(buildChoices(currentCard, pool, subjectPool))
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
    applyRuntime(exam ? applyExamMiss(runtime) : applyIncorrect(runtime))
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

      if (isPreview && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault()
        if (previewGate && event.key === 'ArrowRight') return
        if (event.key === 'ArrowLeft') onPreviewBack()
        else onPreviewContinue()
        return
      }

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

  const unit = exam ? 'вопросов' : kind === 'exercise' ? 'заданий' : 'карточек'

  if (runtime.status === 'empty') {
    return (
      <Screen>
        <SessionChrome title={title} progress="0 / 0" unit={unit} onExit={leave} />
        <div className="mx-auto flex w-full max-w-lg flex-1 items-center px-4 pb-[env(safe-area-inset-bottom)] lg:px-8">
          <EmptyState
            title={exam ? 'Нечего спрашивать' : 'Нечего повторять'}
            text={
              exam
                ? 'В выбранных колодах и упражнениях нет вопросов.'
                : kind === 'exercise'
                  ? 'В этом упражнении пока нет заданий.'
                  : 'На сегодня слов нет. Новые появятся сразу после добавления.'
            }
            action={
              <Button onClick={() => navigate(exam ? '/exam' : kind === 'exercise' ? '/exercises' : '/')}>
                {exam ? 'К выбору' : kind === 'exercise' ? 'К упражнениям' : 'К колодам'}
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
            <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-success-soft text-success">
              <Check size={30} />
            </div>
            <h1 className="font-display text-3xl">Сессия завершена</h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              {kind === 'exercise' ? (
                <>
                  Пройдено {runtime.total} {pluralCards(runtime.total, kind)}. Расписание не меняется — упражнение
                  можно открыть снова в любой момент.
                  {runtime.failedIds.length > 0 ? ` Ошибок по ходу: ${runtime.failedIds.length}.` : ''}
                </>
              ) : (
                <>
                  Батч из {runtime.total} {pluralCards(runtime.total, kind)}. За раз берём {BATCH_SIZE_MAX} карточек максимум.
                  {runtime.failedIds.length > 0
                    ? ` Ошибок: ${runtime.failedIds.length} — без повышения стадии, вернутся завтра.`
                    : ' Все прошли выбор и написание.'}
                </>
              )}
            </p>
            <Button className="mt-8 w-full" onClick={leave}>
              Готово
            </Button>
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
          phase={PHASE_LABEL.preview}
          unit="карточек"
          onExit={leave}
        />
        <PreviewCard
          card={currentCard}
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
        phase={exam ? (runtime.phase === 'spell' ? 'Экзамен · Написание' : 'Экзамен · Выбор') : phaseLabel(runtime.phase, runtime.hasPreview)}
        unit={unit}
        onExit={leave}
      />

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-2 lg:px-8 lg:pb-28">
        <div className="mb-6 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          <span className="inline-flex items-center gap-1.5">
            {current.tier === 1 ? <Check size={14} /> : <PencilLine size={14} />}
            {current.tier === 1 ? 'Выбор' : 'Написание'}
          </span>
          <span className="hidden font-medium normal-case tracking-normal lg:inline">
            {current.tier === 1 ? 'Клавиши 1–4' : 'Enter — проверить'} · пробел — звук
          </span>
        </div>

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

function PreviewCard({
  card,
  canGoBack,
  onBack,
  onContinue,
}: {
  card: Card
  canGoBack: boolean
  onBack: () => void
  onContinue: () => void
}) {
  const italian = (card.term || card.target || '').trim()
  const russian = (card.translation || '').trim()
  const hint = card.notes?.trim() || undefined

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 lg:justify-center lg:px-8 lg:pb-16">
      <p className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
        <BookOpen size={14} />
        Слово
      </p>

      <div className="flex flex-1 flex-col justify-center">
        <div key={card.id} className="animate-rise text-center">
          <div className="flex items-center justify-center gap-3">
            <h1 className="font-display text-[2.75rem] leading-tight text-fg lg:text-7xl">{italian}</h1>
            <SpeakButton text={italian} className="size-11 rounded-2xl bg-surface" />
          </div>
          {russian ? (
            <p className="mt-5 font-display text-2xl leading-snug text-accent lg:text-4xl">{russian}</p>
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
          Назад
        </Button>
        <Button className="min-w-0 flex-1" onClick={onContinue}>
          Запомнил, дальше
          <ChevronRight size={18} />
        </Button>
      </div>
      <p className="mt-3 text-center text-xs text-muted">← → · Enter — дальше · пробел — звук</p>
    </div>
  )
}

function PreviewEndGate({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
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
            Вы закончили ознакомление?
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Дальше начнётся практика. Можно ещё раз пролистать слова.
          </p>
          <div className="mt-5 flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={onCancel}>
              Нет
            </Button>
            <Button className="flex-1" onClick={onConfirm}>
              Да
            </Button>
          </div>
          <p className="mt-3 text-center text-xs text-muted">Enter — да · Esc — нет</p>
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
    return `Заполните пропуск · ${infinitive}`
  }
  return 'Заполните пропуск'
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
          <h1 className="min-w-0 flex-1 font-display text-[2rem] leading-tight lg:text-5xl">{card.term}</h1>
          {speech ? <SpeakButton text={speech} /> : null}
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="text-sm text-muted">Как сказать</p>
      <div className="mt-1 flex items-start gap-2">
        <h1 className="min-w-0 flex-1 font-display text-[2.1rem] leading-tight lg:text-5xl">{card.translation}</h1>
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
  unit = 'карточек',
  onExit,
}: {
  title: string
  progress: string
  ratio?: number
  phase?: string
  unit?: string
  onExit: () => void
}) {
  return (
    <header className="sticky top-0 z-10 bg-bg/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
      <div className="flex items-center gap-2">
        <IconButton label="Выйти" onClick={onExit}>
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

function pluralCards(count: number, kind: 'vocab' | 'exercise'): string {
  const mod10 = count % 10
  const mod100 = count % 100
  const forms =
    kind === 'exercise'
      ? (['задание', 'задания', 'заданий'] as const)
      : (['карточка', 'карточки', 'карточек'] as const)
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1]
  return forms[2]
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

  return (
    <Screen>
      <SessionChrome title="Экзамен" progress={`${runtime.total} / ${runtime.total}`} ratio={1} unit="вопросов" onExit={onDone} />
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
          <h1 className="mt-3 font-display text-2xl">без ошибок</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Вопрос засчитан, только если на каждом шаге ответ верный с первого раза. Расписание не меняется.
          </p>
          <Button className="mt-6 w-full" onClick={onDone}>
            К выбору
          </Button>
        </div>

        {missed.length > 0 ? (
          <div className="mt-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted">Где ошибся</h2>
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
