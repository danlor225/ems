// ============================================================
//  CourseDetailPage — consultation d'un cours et de ses supports.
//  Vidéos embarquées (YouTube/Vimeo/iframe ou <video>) + documents
//  ouverts dans un nouvel onglet.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Lock,
  Video,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  formatFcfa,
  getCourse,
  markAttendance,
  resolveFileUrl,
  type CourseResource,
} from './coursesApi'
import { resolveVideoEmbed } from './videoEmbed'

function VideoResource({ resource }: { resource: CourseResource }) {
  const embed = resolveVideoEmbed(resolveFileUrl(resource.url))
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Video className="size-4 text-primary" />
        {resource.title}
      </p>
      <div className="aspect-video w-full overflow-hidden rounded-xl border border-border bg-black">
        {embed.kind === 'iframe' ? (
          <iframe
            src={embed.src}
            title={resource.title}
            className="size-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <video src={embed.src} controls className="size-full" />
        )}
      </div>
    </div>
  )
}

function DocumentResource({ resource }: { resource: CourseResource }) {
  return (
    <a
      href={resolveFileUrl(resource.url)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted"
    >
      <span className="flex items-center gap-2.5 text-sm font-medium text-foreground">
        <FileText className="size-4 text-primary" />
        {resource.title}
      </span>
      <Download className="size-4 shrink-0 text-muted-foreground" />
    </a>
  )
}

export function CourseDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data, isPending, isError } = useQuery({
    queryKey: ['courses', id],
    queryFn: () => getCourse(id!),
    retry: false,
  })

  // Auto-déclaration de présence (étudiant).
  const attend = useMutation({
    mutationFn: () => markAttendance(id!),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['courses', id] }),
  })

  if (isPending) {
    return (
      <div className="text-sm text-muted-foreground">Chargement du cours…</div>
    )
  }
  if (isError || !data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="text-foreground">Ce cours n'est pas accessible.</p>
          <Button variant="outline" onClick={() => navigate('/cours')}>
            <ArrowLeft className="size-4" />
            Retour aux cours
          </Button>
        </CardContent>
      </Card>
    )
  }

  const videos = data.resources.filter((r) => r.type === 'VIDEO')
  const documents = data.resources.filter((r) => r.type === 'DOCUMENT')

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <button
        type="button"
        onClick={() => navigate('/cours')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Cours
      </button>

      {/* En-tête */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {data.title}
          </h1>
          {!data.isPublished && <Badge variant="warning">Brouillon</Badge>}
          <Badge variant={data.isPaid ? 'info' : 'success'}>
            {data.isPaid ? formatFcfa(data.price) : 'Gratuit'}
          </Badge>
        </div>
        {data.subject && (
          <p className="mt-1 text-sm font-medium text-primary">
            {data.subject.name}
          </p>
        )}
        {data.description && (
          <p className="mt-3 text-sm text-muted-foreground">
            {data.description}
          </p>
        )}
      </div>

      {data.locked ? (
        /* Cours payant verrouillé : contenu masqué tant que l'accès n'est
           pas accordé (paiement / inscription). */
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-info/10 text-info">
              <Lock className="size-6" />
            </div>
            <p className="font-semibold text-foreground">
              Cours payant — {formatFcfa(data.price)}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              L'accès à ce cours est requis pour consulter ses supports.
              Rapprochez-vous de votre enseignant pour l'obtenir.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Présence (auto-déclaration) — réservée aux étudiants */}
          {user?.role === 'STUDENT' && (
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                {data.myAttendanceAt ? (
                  <span className="flex items-center gap-2 text-sm font-medium text-success">
                    <CheckCircle2 className="size-4" />
                    Présence enregistrée le{' '}
                    {new Date(data.myAttendanceAt).toLocaleString('fr-FR')}
                  </span>
                ) : (
                  <>
                    <span className="text-sm text-muted-foreground">
                      Signalez votre présence à ce cours.
                    </span>
                    <Button
                      onClick={() => attend.mutate()}
                      loading={attend.isPending}
                    >
                      <CheckCircle2 className="size-4" />
                      Marquer ma présence
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {data.resources.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Ce cours ne contient pas encore de support.
              </CardContent>
            </Card>
          )}

          {/* Vidéos */}
          {videos.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Vidéos</h2>
              {videos.map((r) => (
                <VideoResource key={r.id} resource={r} />
              ))}
            </section>
          )}

          {/* Documents */}
          {documents.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-foreground">
                Documents
              </h2>
              {documents.map((r) => (
                <DocumentResource key={r.id} resource={r} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}
