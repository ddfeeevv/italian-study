import { BookOpen, CalendarCheck, Check, Compass, Flame, ListChecks, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { LanguageMenu } from './LanguageSwitcher'
import { Mascot } from './Mascot'
import { Button, Field, Input } from './ui'
import { useI18n } from '../i18n/translate'
import { needsOnboarding, ONBOARDING_FEATURES, ONBOARDING_VERSION, type OnboardingFeatureId } from '../lib/onboarding'
import { LANGUAGE_PRESETS } from '../lib/subjects'
import { supabase } from '../lib/supabase'
import { clsx } from '../lib/utils'
import { useAppStore } from '../store/app-store'
import { useAuth } from '../store/auth-store'

const STEPS = ['hello', 'language', 'features'] as const
type Step = (typeof STEPS)[number]

const POINT_ICONS = [BookOpen, CalendarCheck, Compass] as const
const POINT_KEYS = ['onboard.point.cards', 'onboard.point.review', 'onboard.point.pace'] as const

const FEATURE_ICONS: Record<OnboardingFeatureId, typeof BookOpen> = {
  decks: BookOpen,
  review: CalendarCheck,
  practice: ListChecks,
  tutor: Sparkles,
  rhythm: Flame,
}

export function Onboarding({ preview = false, onDone }: { preview?: boolean; onDone: () => void }) {
  const { t, studyTitle } = useI18n()
  const { ready, subjects, decks, activeSubject, addLanguage, addCustomLanguage, setActiveSubject, deleteSubject } =
    useAppStore()
  const [step, setStep] = useState<Step>('hello')
  const [featureIndex, setFeatureIndex] = useState(0)
  const [presetId, setPresetId] = useState<string | null>(activeSubject?.presetId ?? null)
  const [customOpen, setCustomOpen] = useState(Boolean(activeSubject && !activeSubject.presetId))
  const [custom, setCustom] = useState(activeSubject && !activeSubject.presetId ? activeSubject.title : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const customName = custom.trim()
  const usingCustom = customOpen && customName.length > 0
  const hasLanguage = Boolean((!customOpen && presetId) || usingCustom)
  const feature = ONBOARDING_FEATURES[featureIndex]
  const lastFeature = featureIndex === ONBOARDING_FEATURES.length - 1
  const stepNumber = STEPS.indexOf(step) + 1

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    headingRef.current?.focus()
  }, [step, featureIndex])

  const finish = async () => {
    if (!hasLanguage || busy) return
    if (preview) {
      onDone()
      return
    }
    if (!ready) return
    setBusy(true)
    setError(null)
    const name = customName
    const existingCustom = usingCustom
      ? subjects.find((subject) => !subject.presetId && subject.title.trim().toLowerCase() === name.toLowerCase())
      : undefined
    const chosen = usingCustom
      ? existingCustom ?? addCustomLanguage(name)
      : presetId
        ? addLanguage(presetId)
        : null
    if (usingCustom && existingCustom) setActiveSubject(existingCustom.id)
    if (!chosen) {
      setBusy(false)
      setError(t('onboard.saveError'))
      return
    }
    for (const subject of subjects) {
      if (subject.id === chosen.id) continue
      if (decks.some((deck) => deck.subjectId === subject.id)) continue
      deleteSubject(subject.id)
    }
    const { error: saveError } = await supabase.auth.updateUser({
      data: { needs_onboarding: false, onboarding_version: ONBOARDING_VERSION },
    })
    setBusy(false)
    if (saveError) {
      setError(t('onboard.saveError'))
      return
    }
    onDone()
  }

  const forward = () => {
    setError(null)
    if (step === 'hello') {
      setStep('language')
      return
    }
    if (step === 'language') {
      if (!hasLanguage) return
      setFeatureIndex(0)
      setStep('features')
      return
    }
    if (!lastFeature) {
      setFeatureIndex((index) => index + 1)
      return
    }
    void finish()
  }

  const back = () => {
    setError(null)
    if (step === 'features' && featureIndex > 0) {
      setFeatureIndex((index) => index - 1)
      return
    }
    if (step === 'features') setStep('language')
    else if (step === 'language') setStep('hello')
  }

  const FeatureIcon = feature ? FEATURE_ICONS[feature.id] : Sparkles

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-[80] flex flex-col bg-bg"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--accent)_18%,transparent),transparent_70%)]" />
      <header className="relative flex items-center justify-between gap-3 px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Parola</p>
        <LanguageMenu />
      </header>

      <div className="relative mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col px-5">
        <div className="mt-4 flex gap-1.5" aria-hidden="true">
          {STEPS.map((id, index) => (
            <span
              key={id}
              className={clsx(
                'h-1 flex-1 rounded-full transition-colors',
                index < stepNumber ? 'bg-accent' : 'bg-line',
              )}
            />
          ))}
        </div>
        <p className="sr-only">{t('onboard.progress', { step: stepNumber, total: STEPS.length })}</p>

        <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto py-6">
          {step === 'hello' ? (
            <div key="hello" className="animate-rise flex min-h-full flex-col justify-center">
              <Mascot size={148} className="mx-auto" />
              <h1
                id="onboarding-title"
                ref={headingRef}
                tabIndex={-1}
                className="mt-2 text-center font-display text-4xl leading-tight outline-none"
              >
                {t('onboard.welcomeTitle')}
              </h1>
              <p className="mx-auto mt-3 max-w-md text-center text-sm leading-6 text-muted">
                {t('onboard.welcomeText')}
              </p>
              <ul className="mt-8 space-y-2">
                {POINT_KEYS.map((key, index) => {
                  const Icon = POINT_ICONS[index]
                  return (
                    <li key={key} className="flex items-center gap-3 rounded-2xl border border-line bg-card px-3 py-3">
                      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl bg-surface text-accent">
                        <Icon size={18} />
                      </span>
                      <span className="text-sm leading-5">{t(key)}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}

          {step === 'language' ? (
            <div key="language" className="animate-rise">
              <h1
                id="onboarding-title"
                ref={headingRef}
                tabIndex={-1}
                className="font-display text-4xl leading-tight outline-none"
              >
                {t('onboard.langTitle')}
              </h1>
              <p className="mt-3 text-sm leading-6 text-muted">{t('onboard.langLead')}</p>
              <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {LANGUAGE_PRESETS.map((preset) => {
                  const selected = !customOpen && presetId === preset.id
                  return (
                    <li key={preset.id}>
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setPresetId(preset.id)
                          setCustomOpen(false)
                        }}
                        className={clsx(
                          'flex h-full min-h-[4.5rem] w-full flex-col items-start justify-center rounded-2xl border px-3 py-2.5 text-left transition',
                          selected ? 'border-accent bg-surface shadow-[var(--shadow)]' : 'border-line bg-card hover:border-accent/40',
                        )}
                      >
                        <span className="flex w-full items-center justify-between gap-2">
                          <span className="truncate font-display text-lg leading-tight">{preset.fallbacks.vocab[0]}</span>
                          {selected ? <Check size={16} className="shrink-0 text-accent" /> : null}
                        </span>
                        <span className={clsx('mt-0.5 truncate text-sm', selected ? 'text-accent' : 'text-muted')}>
                          {studyTitle(preset.id, preset.title)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              <button
                type="button"
                onClick={() => setCustomOpen(true)}
                className="mt-4 text-sm font-semibold text-muted transition hover:text-fg"
              >
                {t('subject.missing')}
              </button>
              {customOpen ? (
                <div className="mt-3">
                  <p className="mb-3 text-sm leading-6 text-muted">{t('subject.missingLead')}</p>
                  <Field label={t('subject.name')}>
                    <Input
                      value={custom}
                      onChange={(event) => setCustom(event.target.value)}
                      placeholder={t('subject.placeholder')}
                      autoFocus
                    />
                  </Field>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 'features' && feature ? (
            <div key={feature.id} className="animate-rise flex min-h-full flex-col justify-center">
              <div className="rounded-3xl border border-line bg-card px-5 py-10 text-center shadow-[var(--shadow)]">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{t('onboard.tourKicker')}</p>
                {feature.id === 'tutor' ? (
                  <Mascot size={112} className="mx-auto mt-6" />
                ) : (
                  <span className="mx-auto mt-6 inline-flex size-16 items-center justify-center rounded-3xl bg-surface text-accent">
                    <FeatureIcon size={28} />
                  </span>
                )}
                <h1
                  id="onboarding-title"
                  ref={headingRef}
                  tabIndex={-1}
                  className="mt-5 font-display text-4xl leading-tight outline-none"
                >
                  {t(feature.titleKey)}
                </h1>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">{t(feature.textKey)}</p>
                <div className="mt-8 flex items-center justify-center gap-1.5" aria-hidden="true">
                  {ONBOARDING_FEATURES.map((item, index) => (
                    <span
                      key={item.id}
                      className={clsx(
                        'h-1.5 rounded-full transition-all',
                        index === featureIndex ? 'w-6 bg-accent' : 'w-1.5 bg-line',
                      )}
                    />
                  ))}
                </div>
                <p className="sr-only">
                  {t('onboard.slide', { index: featureIndex + 1, total: ONBOARDING_FEATURES.length })}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="mb-3 rounded-2xl bg-danger-soft px-3 py-2 text-center text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div
          className={clsx(
            'grid gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]',
            step === 'hello' ? 'grid-cols-1' : 'grid-cols-2',
          )}
        >
          {step === 'hello' ? null : (
            <Button variant="secondary" onClick={back} disabled={busy}>
              {t('common.back')}
            </Button>
          )}
          <Button
            onClick={forward}
            disabled={busy || (step === 'language' && !hasLanguage) || (step === 'features' && lastFeature && !preview && !ready)}
          >
            {step === 'features' && lastFeature ? t('onboard.begin') : t('common.next')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function OnboardingGate() {
  const { user } = useAuth()
  const [done, setDone] = useState(false)
  if (done || !needsOnboarding(user)) return null
  return <Onboarding onDone={() => setDone(true)} />
}
