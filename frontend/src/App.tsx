import { Loader2 } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ComingSoon } from './components/ComingSoon'
import { ProtectedRoute } from './components/ProtectedRoute'

// ------------------------------------------------------------
//  Chargement paresseux (code-splitting) : chaque page est un
//  chunk séparé, chargé au moment où sa route est visitée.
//  Les exports sont nommés -> on les remappe en "default".
// ------------------------------------------------------------
const AppLayout = lazy(() =>
  import('./components/AppLayout').then((m) => ({ default: m.AppLayout })),
)
const LoginPage = lazy(() =>
  import('./features/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
)
const RegisterPage = lazy(() =>
  import('./features/auth/RegisterPage').then((m) => ({
    default: m.RegisterPage,
  })),
)
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const SettingsPage = lazy(() =>
  import('./features/settings/SettingsPage').then((m) => ({
    default: m.SettingsPage,
  })),
)
const SubjectsPage = lazy(() =>
  import('./features/subjects/SubjectsPage').then((m) => ({
    default: m.SubjectsPage,
  })),
)
const QuestionsPage = lazy(() =>
  import('./features/questions/QuestionsPage').then((m) => ({
    default: m.QuestionsPage,
  })),
)
const ExamsPage = lazy(() =>
  import('./features/exams/ExamsPage').then((m) => ({ default: m.ExamsPage })),
)
const EvaluationsListPage = lazy(() =>
  import('./features/evaluations/EvaluationsListPage').then((m) => ({
    default: m.EvaluationsListPage,
  })),
)
const EvaluationWizard = lazy(() =>
  import('./features/evaluations/EvaluationWizard').then((m) => ({
    default: m.EvaluationWizard,
  })),
)
const UsersListPage = lazy(() =>
  import('./features/users/UsersListPage').then((m) => ({
    default: m.UsersListPage,
  })),
)
const GroupsListPage = lazy(() =>
  import('./features/groups/GroupsListPage').then((m) => ({
    default: m.GroupsListPage,
  })),
)
const CertificatesPage = lazy(() =>
  import('./features/certificates/CertificatesPage').then((m) => ({
    default: m.CertificatesPage,
  })),
)
const CertificateVerifyPage = lazy(() =>
  import('./features/certificates/CertificateVerifyPage').then((m) => ({
    default: m.CertificateVerifyPage,
  })),
)
const CreateExamWizard = lazy(() =>
  import('./features/exams/CreateExamWizard').then((m) => ({
    default: m.CreateExamWizard,
  })),
)
const SessionsPage = lazy(() =>
  import('./features/sessions/SessionsPage').then((m) => ({
    default: m.SessionsPage,
  })),
)
const ResultsPage = lazy(() =>
  import('./features/results/ResultsPage').then((m) => ({
    default: m.ResultsPage,
  })),
)
const ExamPage = lazy(() =>
  import('./features/exam/ExamPage').then((m) => ({ default: m.ExamPage })),
)
const StudentResultPage = lazy(() =>
  import('./features/exam/ResultPage').then((m) => ({ default: m.ResultPage })),
)

function PageLoader() {
  return (
    <div className="grid min-h-screen place-items-center text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Routes publiques */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        {/* Vérification publique d'un certificat (cible du QR code) */}
        <Route path="/verifier/:code" element={<CertificateVerifyPage />} />

        {/* Coquille authentifiée (tous rôles) */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/parametres" element={<SettingsPage />} />
        </Route>

        {/* Coquille admin (TEACHER/ADMIN) */}
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
          <Route
            path="/admin/examens/nouveau"
            element={<CreateExamWizard />}
          />
          <Route path="/admin/sessions" element={<SessionsPage />} />
          <Route path="/admin/resultats" element={<ResultsPage />} />

          {/* v2 : module Évaluations */}
          <Route path="/evaluations" element={<EvaluationsListPage />} />
          <Route path="/evaluations/nouvelle" element={<EvaluationWizard />} />

          {/* v2 : module Groupes / Classes */}
          <Route path="/admin/groupes" element={<GroupsListPage />} />

          {/* v2 : module Certificats */}
          <Route path="/admin/certificats" element={<CertificatesPage />} />

          {/* Modules à venir */}
          <Route
            path="/admin/rapports"
            element={<ComingSoon title="Rapports" />}
          />
        </Route>

        {/* Coquille strictement ADMIN */}
        <Route
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/admin/utilisateurs" element={<UsersListPage />} />
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
              <StudentResultPage />
            </ProtectedRoute>
          }
        />

        {/* URL inconnue -> accueil */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
