import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './features/auth/LoginPage'
import { RegisterPage } from './features/auth/RegisterPage'
import { ExamPage } from './features/exam/ExamPage'
import { ResultPage } from './features/exam/ResultPage'
import { ExamsPage } from './features/exams/ExamsPage'
import { QuestionsPage } from './features/questions/QuestionsPage'
import { ResultsPage } from './features/results/ResultsPage'
import { SessionsPage } from './features/sessions/SessionsPage'
import { SubjectsPage } from './features/subjects/SubjectsPage'
import { DashboardPage } from './pages/DashboardPage'

export default function App() {
  return (
    <Routes>
      {/* Routes publiques */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Coquille authentifiée (tous rôles) : layout + accueil */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
      </Route>

      {/* Coquille admin (TEACHER/ADMIN) : mêmes layout, routes /admin/* */}
      <Route
        element={
          <ProtectedRoute roles={['TEACHER', 'ADMIN']}>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/admin/matieres" element={<SubjectsPage />} />
        <Route path="/admin/questions" element={<QuestionsPage />} />
        <Route path="/admin/examens" element={<ExamsPage />} />
        <Route path="/admin/sessions" element={<SessionsPage />} />
        <Route path="/admin/resultats" element={<ResultsPage />} />
      </Route>

      {/* Passage d'évaluation (étudiant), plein écran */}
      <Route
        path="/evaluations/:sessionId"
        element={
          <ProtectedRoute roles={['STUDENT']}>
            <ExamPage />
          </ProtectedRoute>
        }
      />
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
