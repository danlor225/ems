import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './features/auth/LoginPage'
import { ExamPage } from './features/exam/ExamPage'
import { ResultPage } from './features/exam/ResultPage'
import { DashboardPage } from './pages/DashboardPage'

export default function App() {
  return (
    <Routes>
      {/* Route publique */}
      <Route path="/login" element={<LoginPage />} />

      {/* Accueil protégé (dashboard staff / évaluations étudiant) */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      {/* Passage d'évaluation (étudiant) */}
      <Route
        path="/evaluations/:sessionId"
        element={
          <ProtectedRoute roles={['STUDENT']}>
            <ExamPage />
          </ProtectedRoute>
        }
      />

      {/* Résultat d'une tentative (étudiant) */}
      <Route
        path="/resultats/:attemptId"
        element={
          <ProtectedRoute roles={['STUDENT']}>
            <ResultPage />
          </ProtectedRoute>
        }
      />

      {/* URL inconnue -> accueil */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
