// ============================================================
//  CoursesListPage — liste des cours consultables (design system).
//  Étudiant : uniquement les cours publiés (filtré côté serveur).
//  Staff : tous les cours (un badge signale les brouillons).
// ============================================================
import { useQuery } from '@tanstack/react-query'
import { BookOpen, FileText, Video } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatFcfa, getCourses } from './coursesApi'

export function CoursesListPage() {
  const navigate = useNavigate()
  const { data, isPending, isError } = useQuery({
    queryKey: ['courses'],
    queryFn: () => getCourses(),
  })

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold tracking-tight text-foreground">Cours</h1>

      {isPending ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-40 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-danger">Impossible de charger les cours.</p>
      ) : data.data.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
              <BookOpen className="size-6" />
            </div>
            <p className="text-sm text-muted-foreground">
              Aucun cours disponible pour le moment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.data.map((course) => (
            <Card
              key={course.id}
              onClick={() => navigate(`/cours/${course.id}`)}
              className="cursor-pointer transition-shadow hover:shadow-md"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-foreground">
                    {course.title}
                  </h3>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {!course.isPublished && (
                      <Badge variant="warning">Brouillon</Badge>
                    )}
                    <Badge variant={course.isPaid ? 'info' : 'success'}>
                      {course.isPaid ? formatFcfa(course.price) : 'Gratuit'}
                    </Badge>
                  </div>
                </div>

                {course.subject && (
                  <p className="mt-1 text-xs font-medium text-primary">
                    {course.subject.name}
                  </p>
                )}

                {course.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {course.description}
                  </p>
                )}

                <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <FileText className="size-3.5" />
                    <Video className="size-3.5" />
                    {course._count.resources} ressource
                    {course._count.resources > 1 ? 's' : ''}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
