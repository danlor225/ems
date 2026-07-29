// ============================================================
//  CoursesManagePage — gestion des cours (TEACHER/ADMIN).
//  Liste + formulaire (modal) de création/édition avec un tableau
//  dynamique de ressources (document/vidéo). La publication rend le
//  cours visible des étudiants.
// ============================================================
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import {
  Eye,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Users,
  Wallet,
} from 'lucide-react'
import { useState } from 'react'
import { useFieldArray, useForm, type Resolver } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { getGroups } from '../groups/groupsApi'
import { getSubjects } from '../subjects/subjectsApi'
import {
  createCourse,
  deleteCourse,
  formatFcfa,
  getAccess,
  getAttendance,
  getCourse,
  getCourses,
  grantAccess,
  revokeAccess,
  updateCourse,
  uploadCourseFile,
  type CourseListItem,
} from './coursesApi'

const resourceSchema = z.object({
  type: z.enum(['DOCUMENT', 'VIDEO']),
  title: z.string().min(1, 'Titre requis.').max(200),
  url: z.string().min(1, 'URL requise.').max(2048),
})
const schema = z.object({
  subjectId: z.string().uuid('Choisissez une matière.'),
  title: z.string().min(1, 'Le titre est requis.').max(200),
  description: z.string().max(2000).optional(),
  isPublished: z.boolean().optional(),
  isPaid: z.boolean().optional(),
  // Prix en FCFA (entier >= 0). La conversion chaîne->nombre est faite à
  // la source par l'<input> (register avec valueAsNumber).
  price: z.number().int().min(0, 'Prix invalide.'),
  // Groupe cible : '' = tous les étudiants ; sinon l'id du groupe.
  groupId: z.string().optional(),
  resources: z.array(resourceSchema),
})
type FormValues = z.infer<typeof schema>

const EMPTY: FormValues = {
  subjectId: '',
  title: '',
  description: '',
  isPublished: false,
  isPaid: false,
  price: 0,
  groupId: '',
  resources: [],
}

export function CoursesManagePage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  // Cours ciblé par la modale de présences / d'accès (null = fermée).
  const [attendanceCourse, setAttendanceCourse] =
    useState<CourseListItem | null>(null)
  const [accessCourse, setAccessCourse] = useState<CourseListItem | null>(null)

  const { data, isPending, isError } = useQuery({
    queryKey: ['courses'],
    queryFn: () => getCourses(),
  })
  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => getSubjects(),
  })
  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: () => getGroups({ limit: 100 }),
  })

  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    getValues,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: EMPTY,
  })

  // Le champ prix ne s'affiche que pour un cours payant.
  const isPaid = watch('isPaid')

  const { fields, append, remove } = useFieldArray({ control, name: 'resources' })

  // Téléverse le fichier choisi pour la ressource d'indice `i`, puis
  // renseigne automatiquement son URL (et son titre s'il est vide).
  async function handleUpload(i: number, file: File | undefined) {
    if (!file) return
    setActionError(null)
    setUploadingIndex(i)
    try {
      const type = getValues(`resources.${i}.type`)
      const res = await uploadCourseFile(file, type)
      setValue(`resources.${i}.url`, res.url, { shouldValidate: true })
      if (!getValues(`resources.${i}.title`)) {
        setValue(`resources.${i}.title`, res.title, { shouldValidate: true })
      }
    } catch (error) {
      setActionError(
        axios.isAxiosError(error) && error.response?.status === 400
          ? 'Fichier refusé (type ou taille non autorisés).'
          : "Échec du téléversement.",
      )
    } finally {
      setUploadingIndex(null)
    }
  }

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['courses'] })

  const save = useMutation({
    mutationFn: (v: FormValues) => {
      const body = {
        subjectId: v.subjectId,
        title: v.title,
        description: v.description || undefined,
        isPublished: v.isPublished ?? false,
        isPaid: v.isPaid ?? false,
        price: v.isPaid ? v.price : 0,
        // '' => null (cours public) ; sinon l'id du groupe cible.
        groupId: v.groupId || null,
        resources: v.resources,
      }
      return editingId ? updateCourse(editingId, body) : createCourse(body)
    },
    onSuccess: () => {
      invalidate()
      closeForm()
    },
    onError: () => setActionError("Échec de l'enregistrement du cours."),
  })

  const remove$ = useMutation({
    mutationFn: (id: string) => deleteCourse(id),
    onSuccess: invalidate,
    onError: (error) =>
      setActionError(
        axios.isAxiosError(error) && error.response?.status === 403
          ? 'Vous ne pouvez supprimer que vos propres cours.'
          : 'Erreur lors de la suppression.',
      ),
  })

  function openCreate() {
    setEditingId(null)
    setActionError(null)
    reset(EMPTY)
    setOpen(true)
  }

  async function openEdit(id: string) {
    setActionError(null)
    const course = await getCourse(id)
    setEditingId(id)
    reset({
      subjectId: course.subjectId,
      title: course.title,
      description: course.description ?? '',
      isPublished: course.isPublished,
      isPaid: course.isPaid,
      price: course.price,
      groupId: course.groupId ?? '',
      resources: course.resources.map((r) => ({
        type: r.type,
        title: r.title,
        url: r.url,
      })),
    })
    setOpen(true)
  }

  function closeForm() {
    setOpen(false)
    setEditingId(null)
    reset(EMPTY)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Cours
        </h1>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Nouveau cours
        </Button>
      </div>

      {actionError && (
        <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {actionError}
        </div>
      )}

      {/* Liste */}
      {isPending ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-36 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-danger">Erreur de chargement.</p>
      ) : data.data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Aucun cours. Créez-en un avec « Nouveau cours ».
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.data.map((course: CourseListItem) => (
            <Card key={course.id}>
              <CardContent className="flex h-full flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3
                    className="cursor-pointer font-semibold text-foreground hover:underline"
                    onClick={() => navigate(`/cours/${course.id}`)}
                  >
                    {course.title}
                  </h3>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant={course.isPublished ? 'success' : 'warning'}>
                      {course.isPublished ? 'Publié' : 'Brouillon'}
                    </Badge>
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
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="size-3.5" />
                  {course.group ? `Réservé à ${course.group.name}` : 'Tous les étudiants'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {course._count.resources} ressource
                  {course._count.resources > 1 ? 's' : ''}
                </p>

                {/* Présences (tous) + Accès (cours payants) */}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAttendanceCourse(course)}
                  >
                    <Users className="size-3.5" />
                    Présences
                  </Button>
                  {course.isPaid && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAccessCourse(course)}
                    >
                      <Wallet className="size-3.5" />
                      Accès
                    </Button>
                  )}
                </div>

                <div className="mt-auto flex items-center gap-1 pt-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Modifier"
                    onClick={() => void openEdit(course.id)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Supprimer"
                    onClick={() => remove$.mutate(course.id)}
                    className="text-muted-foreground hover:text-danger"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Formulaire (modal) */}
      <Modal
        open={open}
        onClose={closeForm}
        title={editingId ? 'Modifier le cours' : 'Nouveau cours'}
        className="max-w-2xl"
      >
        <form
          onSubmit={handleSubmit((v) => save.mutate(v))}
          className="max-h-[70vh] space-y-4 overflow-y-auto pr-1"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Titre
            </label>
            <Input placeholder="Titre du cours" {...register('title')} />
            {errors.title && (
              <p className="mt-1 text-xs text-danger">{errors.title.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Matière
            </label>
            <NativeSelect {...register('subjectId')}>
              <option value="">— Choisir une matière —</option>
              {subjects?.data.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
            {errors.subjectId && (
              <p className="mt-1 text-xs text-danger">
                {errors.subjectId.message}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Groupe cible
            </label>
            <NativeSelect {...register('groupId')}>
              <option value="">Tous les étudiants</option>
              {groups?.data.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                  {g.level ? ` (${g.level})` : ''}
                </option>
              ))}
            </NativeSelect>
            <p className="mt-1 text-xs text-muted-foreground">
              Réserve le cours aux étudiants d'un groupe précis, ou laisse
              « Tous » pour le rendre public.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Description
            </label>
            <Textarea
              rows={2}
              placeholder="Description (optionnelle)"
              {...register('description')}
            />
          </div>

          {/* Monétisation */}
          <div className="rounded-lg border border-border p-3">
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                {...register('isPaid')}
              />
              <span className="flex items-center gap-1.5 text-sm text-foreground">
                <Wallet className="size-4 text-info" />
                Cours payant
              </span>
            </label>
            {isPaid && (
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Prix (FCFA)
                </label>
                <Input
                  type="number"
                  min={0}
                  step={100}
                  placeholder="Ex : 5000"
                  {...register('price', { valueAsNumber: true })}
                />
                {errors.price && (
                  <p className="mt-1 text-xs text-danger">
                    {errors.price.message}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Ressources dynamiques */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                Ressources
              </label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    append({ type: 'DOCUMENT', title: '', url: '' })
                  }
                >
                  <Plus className="size-3.5" />
                  Document
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => append({ type: 'VIDEO', title: '', url: '' })}
                >
                  <Plus className="size-3.5" />
                  Vidéo
                </Button>
              </div>
            </div>

            {fields.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                Aucune ressource. Ajoutez un document ou une vidéo (lien).
              </p>
            ) : (
              <div className="space-y-3">
                {fields.map((field, i) => (
                  <div
                    key={field.id}
                    className="rounded-lg border border-border p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <NativeSelect
                        className="h-9 w-36"
                        {...register(`resources.${i}.type`)}
                      >
                        <option value="DOCUMENT">Document</option>
                        <option value="VIDEO">Vidéo</option>
                      </NativeSelect>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Retirer"
                        onClick={() => remove(i)}
                        className="text-muted-foreground hover:text-danger"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <Input
                      className="mb-2"
                      placeholder="Titre de la ressource"
                      {...register(`resources.${i}.title`)}
                    />
                    {errors.resources?.[i]?.title && (
                      <p className="mb-1 text-xs text-danger">
                        {errors.resources[i]?.title?.message}
                      </p>
                    )}
                    <Input
                      placeholder="URL (lien PDF, YouTube, Vimeo…)"
                      {...register(`resources.${i}.url`)}
                    />
                    {errors.resources?.[i]?.url && (
                      <p className="mt-1 text-xs text-danger">
                        {errors.resources[i]?.url?.message}
                      </p>
                    )}

                    {/* Alternative au lien : téléverser un fichier réel.
                        Le backend valide type MIME + taille. */}
                    <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                      {uploadingIndex === i ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          Téléversement…
                        </>
                      ) : (
                        <>
                          <Upload className="size-3.5" />
                          …ou téléverser un fichier
                        </>
                      )}
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.png,.jpg,.jpeg,.mp4,.webm"
                        disabled={uploadingIndex !== null}
                        onChange={(e) => {
                          void handleUpload(i, e.target.files?.[0])
                          e.target.value = '' // permet de re-choisir le même fichier
                        }}
                      />
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Publication */}
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border p-3">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              {...register('isPublished')}
            />
            <span className="flex items-center gap-1.5 text-sm text-foreground">
              {/* Repère visuel de l'état de publication */}
              <Eye className="size-4 text-success" />
              Publier (visible par les étudiants)
            </span>
          </label>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={closeForm}>
              Annuler
            </Button>
            <Button type="submit" loading={save.isPending}>
              {editingId ? 'Enregistrer' : 'Créer le cours'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Feuille de présence */}
      {attendanceCourse && (
        <AttendanceModal
          course={attendanceCourse}
          onClose={() => setAttendanceCourse(null)}
        />
      )}

      {/* Gestion des accès (cours payants) */}
      {accessCourse && (
        <AccessModal
          course={accessCourse}
          onClose={() => setAccessCourse(null)}
        />
      )}
    </div>
  )
}

// ================================================================
//  Modale : feuille de présence d'un cours (lecture seule).
// ================================================================
function AttendanceModal({
  course,
  onClose,
}: {
  course: CourseListItem
  onClose: () => void
}) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['attendance', course.id],
    queryFn: () => getAttendance(course.id),
  })

  return (
    <Modal open onClose={onClose} title="Feuille de présence" description={course.title}>
      {isPending ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : isError ? (
        <p className="text-sm text-danger">Erreur de chargement.</p>
      ) : data.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Aucun étudiant ne s'est encore déclaré présent.
        </p>
      ) : (
        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          <p className="text-xs text-muted-foreground">
            {data.length} présent{data.length > 1 ? 's' : ''}
          </p>
          {data.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5"
            >
              <div>
                <p className="text-sm font-medium text-foreground">
                  {row.firstName} {row.lastName}
                </p>
                <p className="text-xs text-muted-foreground">{row.email}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {new Date(row.markedAt).toLocaleString('fr-FR')}
              </span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

// ================================================================
//  Modale : gestion des accès à un cours payant (accorder / retirer).
// ================================================================
function AccessModal({
  course,
  onClose,
}: {
  course: CourseListItem
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data, isPending, isError } = useQuery({
    queryKey: ['access', course.id],
    queryFn: () => getAccess(course.id),
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['access', course.id] })

  const grant = useMutation({
    mutationFn: (mail: string) => grantAccess(course.id, mail),
    onSuccess: () => {
      setEmail('')
      setError(null)
      invalidate()
    },
    onError: (e) =>
      setError(
        axios.isAxiosError(e) && e.response?.status === 400
          ? 'Étudiant introuvable (email).'
          : "Échec de l'octroi d'accès.",
      ),
  })

  const revoke = useMutation({
    mutationFn: (studentId: string) => revokeAccess(course.id, studentId),
    onSuccess: invalidate,
  })

  return (
    <Modal
      open
      onClose={onClose}
      title="Accès au cours payant"
      description={`${course.title} — ${formatFcfa(course.price)}`}
    >
      <div className="space-y-4">
        {/* Octroi par email */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (email.trim()) grant.mutate(email.trim())
          }}
          className="flex gap-2"
        >
          <Input
            type="email"
            placeholder="Email de l'étudiant"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" loading={grant.isPending}>
            Accorder
          </Button>
        </form>
        {error && <p className="text-xs text-danger">{error}</p>}

        {/* Liste des accès */}
        {isPending ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : isError ? (
          <p className="text-sm text-danger">Erreur de chargement.</p>
        ) : data.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Aucun étudiant n'a encore accès à ce cours.
          </p>
        ) : (
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {data.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {row.firstName} {row.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">{row.email}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Retirer l'accès"
                  onClick={() => revoke.mutate(row.id)}
                  className="text-muted-foreground hover:text-danger"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
