import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { Onboarding } from './components/Onboarding'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AccountPage } from './pages/AccountPage'
import { AuthPage } from './pages/AuthPage'
import { ClassPage } from './pages/ClassPage'
import { DeckDetailPage } from './pages/DeckDetailPage'
import { DecksPage } from './pages/DecksPage'
import { ExerciseDetailPage } from './pages/ExerciseDetailPage'
import { ExercisesPage } from './pages/ExercisesPage'
import { ExamPage, ExamSessionPage } from './pages/ExamPage'
import { JoinPage } from './pages/JoinPage'
import { ReviewPage } from './pages/ReviewPage'
import { SessionPage } from './pages/SessionPage'
import { SharePage } from './pages/SharePage'
import { AppStoreProvider } from './store/app-store'
import { AuthProvider } from './store/auth-store'
import { SocialProvider } from './store/social-store'
import { StreakProvider } from './store/streak-store'
import { ThemeSync } from './store/theme'

export default function App() {
  return (
    <AuthProvider>
      <StreakProvider>
        <SocialProvider>
          <AppStoreProvider>
            <ThemeSync />
            <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
              <Routes>
                <Route path="/login" element={<AuthPage />} />
                {import.meta.env.DEV ? <Route path="/onboarding-preview" element={<OnboardingPreview />} /> : null}
                <Route element={<ProtectedRoute />}>
                  <Route element={<AppShell />}>
                    <Route path="/" element={<DecksPage />} />
                    <Route path="/decks/:deckId" element={<DeckDetailPage />} />
                    <Route path="/review" element={<ReviewPage />} />
                    <Route path="/exercises" element={<ExercisesPage />} />
                    <Route path="/exercises/:deckId" element={<ExerciseDetailPage />} />
                    <Route path="/exam" element={<ExamPage />} />
                    <Route path="/add" element={<Navigate to="/" replace />} />
                    <Route path="/account" element={<AccountPage />} />
                    <Route path="/class" element={<ClassPage />} />
                    <Route path="/join/:code" element={<JoinPage />} />
                    <Route path="/share/:code" element={<SharePage />} />
                    <Route path="/settings" element={<Navigate to="/account" replace />} />
                  </Route>
                  <Route path="/study" element={<ErrorBoundary><SessionPage kind="vocab" /></ErrorBoundary>} />
                  <Route path="/study/:deckId" element={<ErrorBoundary><SessionPage kind="vocab" /></ErrorBoundary>} />
                  <Route path="/drill" element={<Navigate to="/exercises" replace />} />
                  <Route path="/drill/:deckId" element={<ErrorBoundary><SessionPage kind="exercise" /></ErrorBoundary>} />
                  <Route path="/exam/run" element={<ErrorBoundary><ExamSessionPage /></ErrorBoundary>} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </AppStoreProvider>
        </SocialProvider>
      </StreakProvider>
    </AuthProvider>
  )
}

function OnboardingPreview() {
  const navigate = useNavigate()
  return <Onboarding preview onDone={() => navigate('/', { replace: true })} />
}
