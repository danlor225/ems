// ============================================================
//  CertificateVerifyPage — page PUBLIQUE (/verifier/:code).
//  Accessible sans connexion : c'est la cible du QR code.
// ============================================================
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Loader2, ShieldX, XCircle } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { verifyCertificate } from './certificatesApi'

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
})

export function CertificateVerifyPage() {
  const { code = '' } = useParams()
  const { data, isPending, isError } = useQuery({
    queryKey: ['verify-certificate', code],
    queryFn: () => verifyCertificate(code),
    retry: false,
  })

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-12">
      <div className="mx-auto max-w-lg">
        {/* Marque */}
        <div className="mb-8 text-center">
          <p className="text-2xl font-bold tracking-tight text-sidebar">EMS</p>
          <p className="text-sm text-muted-foreground">
            Vérification de certificat
          </p>
        </div>

        <Card className="p-8">
          {isPending ? (
            <div className="grid h-40 place-items-center text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : isError || !data || !data.found ? (
            <Result
              icon={<ShieldX className="size-10 text-danger" />}
              title="Certificat introuvable"
              subtitle={`Aucun certificat ne correspond au code « ${code} ».`}
              tone="danger"
            />
          ) : data.valid ? (
            <>
              <Result
                icon={<CheckCircle2 className="size-10 text-success" />}
                title="Certificat authentique"
                subtitle="Ce certificat est valide et vérifié."
                tone="success"
              />
              <Details cert={data.certificate} />
            </>
          ) : (
            <>
              <Result
                icon={<XCircle className="size-10 text-danger" />}
                title="Certificat révoqué"
                subtitle={
                  data.revokedAt
                    ? `Révoqué le ${dateFmt.format(new Date(data.revokedAt))}.`
                    : 'Ce certificat a été révoqué.'
                }
                tone="danger"
              />
              <Details cert={data.certificate} />
            </>
          )}
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Évaluation Management Système · vérification officielle
        </p>
      </div>
    </div>
  )
}

function Result({
  icon,
  title,
  subtitle,
  tone,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  tone: 'success' | 'danger'
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div
        className={
          tone === 'success'
            ? 'grid size-16 place-items-center rounded-full bg-success/10'
            : 'grid size-16 place-items-center rounded-full bg-danger/10'
        }
      >
        {icon}
      </div>
      <h1 className="mt-4 text-lg font-bold text-foreground">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  )
}

function Details({
  cert,
}: {
  cert: {
    code: string
    studentName: string
    matricule: string | null
    className: string | null
    evaluationTitle: string
    subjectName: string | null
    note: number
    totalPoints: number
    mention: string
    issuedAt: string
  }
}) {
  const line = (label: string, value: string) => (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  )
  return (
    <dl className="mt-6 divide-y divide-border border-t border-border text-sm">
      {line('Titulaire', cert.studentName)}
      {cert.matricule && line('Matricule', cert.matricule)}
      {cert.className && line('Classe', cert.className)}
      {line(
        'Évaluation',
        cert.subjectName
          ? `${cert.evaluationTitle} — ${cert.subjectName}`
          : cert.evaluationTitle,
      )}
      {line('Note', `${cert.note} / ${cert.totalPoints}`)}
      {line('Mention', cert.mention)}
      {line('Délivré le', dateFmt.format(new Date(cert.issuedAt)))}
      {line('Code', cert.code)}
    </dl>
  )
}
