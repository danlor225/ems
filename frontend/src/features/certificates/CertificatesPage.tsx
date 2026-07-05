// ============================================================
//  CertificatesPage — certificats émis (staff).
//  Liste filtrable, téléchargement PDF (avec QR), révocation.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Ban,
  Download,
  MoreVertical,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { cn } from '@/lib/utils'
import { generateCertificatePdf } from './certificatePdf'
import {
  getCertificates,
  revokeCertificate,
  type CertificateRow,
} from './certificatesApi'

const FILTERS = [
  { key: 'ALL', label: 'Tous' },
  { key: 'valid', label: 'Valides' },
  { key: 'revoked', label: 'Révoqués' },
] as const

const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' })

export function CertificatesPage() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('ALL')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)

  const { data, isPending, isError } = useQuery({
    queryKey: ['certificates', filter, debouncedSearch],
    queryFn: () =>
      getCertificates({
        status: filter === 'ALL' ? undefined : filter,
        search: debouncedSearch || undefined,
        limit: 100,
      }),
  })

  const revoke = useMutation({
    mutationFn: revokeCertificate,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['certificates'] }),
  })

  const rows = data?.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Certificats
          </h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.meta.total} certificat(s) émis` : ' '}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                filter === f.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher (code, nom, matricule)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        {isPending ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : isError ? (
          <p className="p-6 text-sm text-danger">Erreur de chargement.</p>
        ) : rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            Aucun certificat. Émettez-en depuis la page Résultats.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Code</TableHead>
                <TableHead>Étudiant</TableHead>
                <TableHead>Évaluation</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Mention</TableHead>
                <TableHead>Émis le</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <CertificateRowView
                  key={c.id}
                  cert={c}
                  onRevoke={() => revoke.mutate(c.id)}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}

function CertificateRowView({
  cert,
  onRevoke,
}: {
  cert: CertificateRow
  onRevoke: () => void
}) {
  const [downloading, setDownloading] = useState(false)
  const revoked = cert.revokedAt !== null

  async function download() {
    setDownloading(true)
    try {
      await generateCertificatePdf(cert)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <TableRow>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {cert.code}
      </TableCell>
      <TableCell>
        <span className="block font-medium text-foreground">
          {cert.studentName}
        </span>
        {cert.matricule && (
          <span className="block text-xs text-muted-foreground">
            {cert.matricule}
          </span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {cert.evaluationTitle}
      </TableCell>
      <TableCell className="font-medium text-foreground">
        {cert.note} / {cert.totalPoints}
      </TableCell>
      <TableCell className="text-muted-foreground">{cert.mention}</TableCell>
      <TableCell className="text-muted-foreground">
        {dateFmt.format(new Date(cert.issuedAt))}
      </TableCell>
      <TableCell>
        <span
          className={cn(
            'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
            revoked
              ? 'bg-danger/15 text-danger'
              : 'bg-success/15 text-success',
          )}
        >
          {revoked ? 'Révoqué' : 'Valide'}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            loading={downloading}
            onClick={download}
          >
            <Download className="size-4" />
            PDF
          </Button>
          {!revoked && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Actions"
                  className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <MoreVertical className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem disabled className="text-muted-foreground">
                  <ShieldCheck className="size-4" />
                  {cert.code}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    if (
                      window.confirm(
                        `Révoquer le certificat ${cert.code} ? Cette action est définitive.`,
                      )
                    )
                      onRevoke()
                  }}
                  className="text-danger focus:bg-danger/10"
                >
                  <Ban className="size-4" />
                  Révoquer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}
