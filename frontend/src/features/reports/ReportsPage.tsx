// ============================================================
//  ReportsPage — rapports analytiques agrégés (staff).
//  KPIs globaux + réussite par matière / groupe + évolution.
// ============================================================
import { useQuery } from '@tanstack/react-query'
import {
  BookOpen,
  CheckCircle2,
  Download,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StatCard } from '@/components/ui/stat-card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getReports, type Aggregate } from './reportsApi'
import { exportReportsExcel, exportReportsPdf } from './reportsExport'

export function ReportsPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['reports'],
    queryFn: getReports,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Rapports
        </h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={!data}>
              <Download className="size-4" />
              Exporter
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              onSelect={() => data && void exportReportsPdf(data)}
            >
              PDF
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => data && void exportReportsExcel(data)}
            >
              Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-28 animate-pulse" />
          ))}
        </div>
      ) : isError || !data ? (
        <p className="text-sm text-danger">Erreur de chargement.</p>
      ) : data.overview.participants === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Aucune donnée : aucune évaluation n'a encore été passée.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Participations"
              icon={Users}
              value={data.overview.participants}
            />
            <StatCard
              label="Moyenne générale"
              icon={TrendingUp}
              value={`${data.overview.average}%`}
            />
            <StatCard
              label="Taux de réussite"
              icon={CheckCircle2}
              value={`${data.overview.successRate}%`}
            />
          </div>

          <ReportSection
            title="Réussite par matière"
            head="Matière"
            icon={BookOpen}
            items={data.bySubject}
          />
          <ReportSection
            title="Réussite par groupe / classe"
            head="Groupe"
            icon={Users}
            items={data.byGroup}
          />
          <ReportSection
            title="Évolution dans le temps"
            head="Période"
            icon={TrendingUp}
            items={data.timeline}
          />
        </>
      )}
    </div>
  )
}

function ReportSection({
  title,
  head,
  icon: Icon,
  items,
}: {
  title: string
  head: string
  icon: typeof Users
  items: Aggregate[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune donnée.</p>
        ) : (
          <>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={items}
                  margin={{ top: 8, right: 8, left: -16, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    interval={0}
                    angle={-12}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    unit="%"
                  />
                  <Tooltip
                    formatter={(v, name) => [
                      `${v}%`,
                      name === 'successRate' ? 'Réussite' : 'Moyenne',
                    ]}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid #E2E8F0',
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="successRate"
                    name="successRate"
                    fill="#1D4ED8"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="average"
                    name="average"
                    fill="#60A5FA"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{head}</TableHead>
                  <TableHead>Participations</TableHead>
                  <TableHead>Moyenne</TableHead>
                  <TableHead>Réussite</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((a) => (
                  <TableRow key={a.label}>
                    <TableCell className="font-medium text-foreground">
                      {a.label}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.participants}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.average}%
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          a.successRate >= 50
                            ? 'font-medium text-success'
                            : 'font-medium text-warning'
                        }
                      >
                        {a.successRate}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  )
}
