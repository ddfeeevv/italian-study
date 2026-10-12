import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AccountPage } from './pages/AccountPage'
import { AddWordsPage } from './pages/AddWordsPage'
import { AuthPage } from './pages/AuthPage'
import { DeckDetailPage } from './pages/DeckDetailPage'
import { DecksPage } from './pages/DecksPage'
import { ReviewPage } from './pages/ReviewPage'
import { SessionPage } from './pages/SessionPage'
import { AppStoreProvider } from './store/app-store'
import { AuthProvider } from './store/auth-store'
import { ThemeSync } from './store/theme'

export default function App() {
  return (
    <AuthProvider>
      <AppStoreProvider>
        <ThemeSync />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<AuthPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route path="/" element={<DecksPage />} />
                <Route path="/decks/:deckId" element={<DeckDetailPage />} />
                <Route path="/review" element={<ReviewPage />} />
                <Route path="/add" element={<AddWordsPage />} />
                <Route path="/account" element={<AccountPage />} />
                <Route path="/settings" element={<Navigate to="/account" replace />} />
              </Route>
              <Route path="/study" element={<SessionPage />} />
              <Route path="/study/:deckId" element={<SessionPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AppStoreProvider>
    </AuthProvider>
  )
}
