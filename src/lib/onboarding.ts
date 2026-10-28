import type { User } from '@supabase/supabase-js'
import type { MessageKey } from '../i18n/messages'

/**
 * First-run tour, shown once after sign-up.
 * To teach something new, add a slide here and the matching `onboard.feat.*` copy.
 * People who already finished keep `needs_onboarding: false` and do not see it again.
 */
export const ONBOARDING_VERSION = 1

export const ONBOARDING_FEATURES = [
  { id: 'decks', titleKey: 'onboard.feat.decks.title', textKey: 'onboard.feat.decks.text' },
  { id: 'review', titleKey: 'onboard.feat.review.title', textKey: 'onboard.feat.review.text' },
  { id: 'practice', titleKey: 'onboard.feat.practice.title', textKey: 'onboard.feat.practice.text' },
  { id: 'tutor', titleKey: 'onboard.feat.tutor.title', textKey: 'onboard.feat.tutor.text' },
  { id: 'rhythm', titleKey: 'onboard.feat.rhythm.title', textKey: 'onboard.feat.rhythm.text' },
] as const satisfies readonly { id: string; titleKey: MessageKey; textKey: MessageKey }[]

export type OnboardingFeatureId = (typeof ONBOARDING_FEATURES)[number]['id']

export function needsOnboarding(user: User | null | undefined): boolean {
  return user?.user_metadata?.needs_onboarding === true
}
