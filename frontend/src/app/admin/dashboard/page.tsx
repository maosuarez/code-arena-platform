"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Users, Trophy, Target, Plus, Eye, Lock, Map, Pencil, X, CheckCircle, ChevronDown, ChevronUp, Trash2 } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import Link from "next/link"
import { apiRequest } from "@/lib/api"
import { useAuth } from "@/hooks/useAuth"
import MazeEditor from "@/components/competition/maze-editor"
import { LANGUAGE_NAMES } from "@/lib/types"

type TestCase = { input: string; expected: string }
type ProblemDraft = {
  id: string
  title: string
  difficulty: "easy" | "medium" | "hard"
  statement: string
  language_ids: number[]
  time_limit: number
  memory_limit: number
  hidden_instructions?: string
  testCases: TestCase[]
}

const ALL_LANGUAGE_IDS = [71, 62, 54, 63]

interface AdminUser {
  id: string
  username: string
  email: string
  teamCode?: string
  is_admin?: boolean
}

interface AdminTeam {
  id: string
  code: string
  teamName: string
  points: number
  currentMembers?: number
}

interface AdminCompetition {
  id: string
  title: string
  description?: string
  status: string
  teams: string[]
  problems: { id: string; title?: string; difficulty?: string; statement?: string; hidden_instructions?: string }[]
  scoring?: { easy: number; medium: number; hard: number }
  start_time?: string
  end_time?: string
  duration?: number
  maxTeamSize?: number
}

interface AdminStats {
  users: AdminUser[]
  teams: AdminTeam[]
  competitions: AdminCompetition[]
}

export default function AdminDashboard() {
  const router = useRouter()
  const { isAuthenticated, isLoading, currentUser } = useAuth()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [changingPassword, setChangingPassword] = useState(false)
  const [mazeEditorCompId, setMazeEditorCompId] = useState<string | null>(null)

  // Edit competition state
  const [editingComp, setEditingComp] = useState<AdminCompetition | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editStatus, setEditStatus] = useState("")
  const [editStartTime, setEditStartTime] = useState("")
  const [editEndTime, setEditEndTime] = useState("")
  const [editEasy, setEditEasy] = useState(10)
  const [editMedium, setEditMedium] = useState(30)
  const [editHard, setEditHard] = useState(50)
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // Problem management within edit dialog
  const [editProblems, setEditProblems] = useState<ProblemDraft[]>([])
  const [expandedEditProblem, setExpandedEditProblem] = useState<string | null>(null)
  const [newProbTitle, setNewProbTitle] = useState("")
  const [newProbStatement, setNewProbStatement] = useState("")
  const [newProbDifficulty, setNewProbDifficulty] = useState<"easy" | "medium" | "hard">("easy")
  const [newProbLanguages, setNewProbLanguages] = useState<number[]>([71, 62, 54, 63])
  const [newProbHidden, setNewProbHidden] = useState("")
  const [draftTestCases, setDraftTestCases] = useState<TestCase[]>([{ input: "", expected: "" }])
  const [isVerifyingProblem, setIsVerifyingProblem] = useState<string | null>(null)

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated || !currentUser?.is_admin) {
      router.replace("/")
    }
  }, [isAuthenticated, isLoading, currentUser, router])

  useEffect(() => {
    if (!isAuthenticated || !currentUser?.is_admin) return

    apiRequest<AdminStats>("/users/admin/stats", { method: "GET", token: true })
      .then((data) => setStats(data))
      .catch(() => toast.error("Error al cargar estadísticas"))
      .finally(() => setStatsLoading(false))
  }, [isAuthenticated, currentUser])

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error("Completa ambos campos")
      return
    }
    setChangingPassword(true)
    try {
      await apiRequest("/users/change-password", {
        method: "PUT",
        token: true,
        body: { current_password: currentPassword, new_password: newPassword },
      })
      toast.success("Contraseña actualizada")
      setCurrentPassword("")
      setNewPassword("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al cambiar contraseña")
    } finally {
      setChangingPassword(false)
    }
  }

  const openEdit = (comp: AdminCompetition) => {
    setEditingComp(comp)
    setEditTitle(comp.title)
    setEditDescription(comp.description ?? "")
    setEditStatus(comp.status)
    setEditStartTime(comp.start_time ? comp.start_time.slice(0, 16) : "")
    setEditEndTime(comp.end_time ? comp.end_time.slice(0, 16) : "")
    setEditEasy(comp.scoring?.easy ?? 10)
    setEditMedium(comp.scoring?.medium ?? 30)
    setEditHard(comp.scoring?.hard ?? 50)
    // Populate problems for editing
    setEditProblems(comp.problems.map(p => ({
      id: p.id,
      title: p.title ?? "",
      difficulty: (p.difficulty ?? "easy") as "easy" | "medium" | "hard",
      statement: p.statement ?? "",
      language_ids: [71, 62, 54, 63],
      time_limit: 2.0,
      memory_limit: 256,
      hidden_instructions: p.hidden_instructions,
      testCases: [],
    })))
    setExpandedEditProblem(null)
    setNewProbTitle("")
    setNewProbStatement("")
    setNewProbDifficulty("easy")
    setNewProbLanguages([71, 62, 54, 63])
    setNewProbHidden("")
    setDraftTestCases([{ input: "", expected: "" }])
  }

  const saveEdit = async () => {
    if (!editingComp) return
    setIsSavingEdit(true)
    try {
      const payload: Record<string, unknown> = {
        title: editTitle,
        description: editDescription,
        status: editStatus,
        scoring: { easy: editEasy, medium: editMedium, hard: editHard },
        problems: editProblems.map(p => ({
          id: p.id,
          title: p.title,
          difficulty: p.difficulty,
          statement: p.statement,
          language_ids: p.language_ids,
          time_limit: p.time_limit,
          memory_limit: p.memory_limit,
          hidden_instructions: p.hidden_instructions,
          testCases: p.testCases,
        })),
      }
      if (editStartTime) payload.start_time = new Date(editStartTime).toISOString()
      if (editEndTime) payload.end_time = new Date(editEndTime).toISOString()

      await apiRequest(`/competition/${editingComp.id}`, {
        method: "PATCH",
        token: true,
        body: payload,
      })
      toast.success("Competencia actualizada")
      // Refresh stats
      const data = await apiRequest<AdminStats>("/users/admin/stats", { method: "GET", token: true })
      setStats(data)
      setEditingComp(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar")
    } finally {
      setIsSavingEdit(false)
    }
  }

  // Problem helpers for edit dialog
  const getDifficultyColor = (d: string) => {
    if (d === "easy") return "text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:border-green-800 dark:bg-green-950"
    if (d === "medium") return "text-yellow-600 border-yellow-200 bg-yellow-50 dark:text-yellow-400 dark:border-yellow-800 dark:bg-yellow-950"
    return "text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-800 dark:bg-red-950"
  }
  const difficultyLabel = (d: string) => d === "easy" ? "Fácil" : d === "medium" ? "Medio" : "Difícil"

  const toggleEditLang = (id: number) =>
    setNewProbLanguages(prev => prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id])

  const addDraftTestCase = () => setDraftTestCases(prev => [...prev, { input: "", expected: "" }])
  const removeDraftTestCase = (i: number) => setDraftTestCases(prev => prev.filter((_, idx) => idx !== i))
  const updateDraftTestCase = (i: number, field: "input" | "expected", value: string) =>
    setDraftTestCases(prev => prev.map((tc, idx) => idx === i ? { ...tc, [field]: value } : tc))

  const addProblemToEdit = () => {
    if (!newProbTitle.trim() || !newProbStatement.trim()) return
    if (newProbLanguages.length === 0) { toast.error("Selecciona al menos un lenguaje"); return }
    const problem: ProblemDraft = {
      id: crypto.randomUUID(),
      title: newProbTitle.trim(),
      statement: newProbStatement.trim(),
      difficulty: newProbDifficulty,
      language_ids: newProbLanguages,
      time_limit: 2.0,
      memory_limit: 256,
      hidden_instructions: newProbHidden.trim() || undefined,
      testCases: draftTestCases.filter(tc => tc.input.trim() || tc.expected.trim()),
    }
    setEditProblems(prev => [...prev, problem])
    setNewProbTitle("")
    setNewProbStatement("")
    setNewProbDifficulty("easy")
    setNewProbLanguages([71, 62, 54, 63])
    setNewProbHidden("")
    setDraftTestCases([{ input: "", expected: "" }])
  }

  const removeProblemFromEdit = (id: string) =>
    setEditProblems(prev => prev.filter(p => p.id !== id))

  const addTestCaseToEditProblem = (problemId: string) =>
    setEditProblems(prev => prev.map(p =>
      p.id === problemId ? { ...p, testCases: [...p.testCases, { input: "", expected: "" }] } : p
    ))

  const updateEditProblemTestCase = (problemId: string, i: number, field: "input" | "expected", value: string) =>
    setEditProblems(prev => prev.map(p =>
      p.id === problemId
        ? { ...p, testCases: p.testCases.map((tc, idx) => idx === i ? { ...tc, [field]: value } : tc) }
        : p
    ))

  const removeEditProblemTestCase = (problemId: string, i: number) =>
    setEditProblems(prev => prev.map(p =>
      p.id === problemId ? { ...p, testCases: p.testCases.filter((_, idx) => idx !== i) } : p
    ))

  const verifyProblemTestCases = async (problem: ProblemDraft) => {
    if (problem.testCases.length === 0) { toast.error("No hay casos de prueba para verificar"); return }
    setIsVerifyingProblem(problem.id)
    try {
      await apiRequest(`/competition/problems/${problem.id}/testcases`, {
        method: "PUT",
        token: true,
        body: { cases: problem.testCases },
      })
      toast.success(`Casos de prueba de "${problem.title}" verificados y guardados`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al verificar")
    } finally {
      setIsVerifyingProblem(null)
    }
  }

  if (isLoading || (!currentUser?.is_admin && !isLoading)) {
    return null
  }

  const competitionStatusLabel = (status: string) => {
    switch (status) {
      case "active": return "Activa"
      case "inactive": return "Inactiva"
      case "completed": return "Finalizada"
      case "upcoming": return "Próxima"
      default: return status
    }
  }

  const competitionStatusClass = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "completed": return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
      case "upcoming": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      default: return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Panel de Administración</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">Gestión de usuarios, equipos y competencias</p>
          </div>
          <Link href="/admin/create">
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Competencia
            </Button>
          </Link>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Usuarios</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.users.length ?? "—"}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Equipos</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.teams.length ?? "—"}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Competencias</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.competitions.length ?? "—"}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="competitions">
          <TabsList className="mb-6">
            <TabsTrigger value="competitions">Competencias</TabsTrigger>
            <TabsTrigger value="teams">Equipos</TabsTrigger>
            <TabsTrigger value="users">Usuarios</TabsTrigger>
            <TabsTrigger value="settings">Configuración</TabsTrigger>
          </TabsList>

          {/* Competitions tab */}
          <TabsContent value="competitions">
            {statsLoading ? (
              <p className="text-muted-foreground">Cargando...</p>
            ) : (
              <div className="space-y-4">
                {stats?.competitions.length === 0 && (
                  <p className="text-muted-foreground">No hay competencias creadas aún.</p>
                )}
                {stats?.competitions.map((comp) => (
                  <Card key={comp.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <CardTitle className="text-lg">{comp.title}</CardTitle>
                            <Badge className={competitionStatusClass(comp.status)}>
                              {competitionStatusLabel(comp.status)}
                            </Badge>
                          </div>
                          <div className="flex gap-4 text-sm text-muted-foreground">
                            <span>{comp.teams.length} equipos</span>
                            <span>{comp.problems.length} problemas</span>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Link href={`/ranking/${comp.id}`}>
                            <Button size="sm" variant="outline">
                              <Eye className="w-4 h-4 mr-1" />
                              Ranking
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEdit(comp)}
                          >
                            <Pencil className="w-4 h-4 mr-1" />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setMazeEditorCompId(comp.id)}
                          >
                            <Map className="w-4 h-4 mr-1" />
                            Laberinto
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Teams tab */}
          <TabsContent value="teams">
            {statsLoading ? (
              <p className="text-muted-foreground">Cargando...</p>
            ) : (
              <div className="space-y-3">
                {stats?.teams.length === 0 && (
                  <p className="text-muted-foreground">No hay equipos registrados.</p>
                )}
                {stats?.teams.map((team) => (
                  <Card key={team.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{team.teamName}</p>
                          <p className="text-sm text-muted-foreground font-mono">{team.code}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-accent">{team.points} pts</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Users tab */}
          <TabsContent value="users">
            {statsLoading ? (
              <p className="text-muted-foreground">Cargando...</p>
            ) : (
              <div className="space-y-3">
                {stats?.users.map((user) => (
                  <Card key={user.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{user.username}</p>
                            {user.is_admin && (
                              <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                Admin
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          {user.teamCode ? (
                            <span className="font-mono">{user.teamCode}</span>
                          ) : (
                            <span>Sin equipo</span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Settings tab */}
          <TabsContent value="settings">
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Cambiar Contraseña
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Contraseña actual</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nueva contraseña</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <Button
                  onClick={handleChangePassword}
                  disabled={changingPassword}
                  className="w-full bg-accent hover:bg-accent/90"
                >
                  {changingPassword ? "Actualizando..." : "Actualizar contraseña"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Competition Dialog */}
      <Dialog open={!!editingComp} onOpenChange={open => !open && setEditingComp(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Editar Competencia — {editingComp?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Título</Label>
              <Input id="edit-title" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Descripción</Label>
              <Textarea id="edit-description" value={editDescription} onChange={e => setEditDescription(e.target.value)} className="min-h-[80px]" />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activa</SelectItem>
                  <SelectItem value="inactive">Inactiva</SelectItem>
                  <SelectItem value="upcoming">Próxima</SelectItem>
                  <SelectItem value="completed">Finalizada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-start">Inicio</Label>
                <Input id="edit-start" type="datetime-local" value={editStartTime} onChange={e => setEditStartTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-end">Fin</Label>
                <Input id="edit-end" type="datetime-local" value={editEndTime} onChange={e => setEditEndTime(e.target.value)} />
              </div>
            </div>
            <Separator />
            <div>
              <p className="text-sm font-semibold mb-3">Puntuación</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Fácil (pts)</Label>
                  <Input type="number" value={editEasy} onChange={e => setEditEasy(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Medio (pts)</Label>
                  <Input type="number" value={editMedium} onChange={e => setEditMedium(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Difícil (pts)</Label>
                  <Input type="number" value={editHard} onChange={e => setEditHard(Number(e.target.value))} />
                </div>
              </div>
            </div>
            <Separator />
            {/* Problems section */}
            <div className="space-y-4">
              <p className="text-sm font-semibold">Challenges ({editProblems.length})</p>

              {/* Existing problems list */}
              {editProblems.length > 0 && (
                <ScrollArea className="max-h-64">
                  <div className="space-y-2">
                    {editProblems.map(problem => (
                      <div key={problem.id} className="border rounded-lg overflow-hidden">
                        <div
                          className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/40"
                          onClick={() => setExpandedEditProblem(expandedEditProblem === problem.id ? null : problem.id)}
                        >
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                            <div>
                              <p className="font-medium text-sm">{problem.title}</p>
                              <Badge className={`text-xs ${getDifficultyColor(problem.difficulty)}`}>
                                {difficultyLabel(problem.difficulty)}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isVerifyingProblem === problem.id}
                              onClick={e => { e.stopPropagation(); verifyProblemTestCases(problem) }}
                            >
                              {isVerifyingProblem === problem.id ? "..." : "Verificar"}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); removeProblemFromEdit(problem.id) }}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                            {expandedEditProblem === problem.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </div>
                        {expandedEditProblem === problem.id && (
                          <div className="px-4 pb-4 border-t space-y-3 pt-3">
                            <div className="text-xs font-mono bg-muted/40 p-2 rounded max-h-20 overflow-y-auto whitespace-pre-wrap">
                              {problem.statement}
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-muted-foreground uppercase">Casos de prueba</p>
                                <Button variant="outline" size="sm" onClick={() => addTestCaseToEditProblem(problem.id)}>
                                  <Plus className="h-3 w-3 mr-1" />Añadir
                                </Button>
                              </div>
                              <div className="space-y-2">
                                {problem.testCases.map((tc, i) => (
                                  <div key={i} className="grid grid-cols-2 gap-2 items-start">
                                    <Textarea
                                      value={tc.input}
                                      onChange={e => updateEditProblemTestCase(problem.id, i, "input", e.target.value)}
                                      placeholder="stdin"
                                      className="font-mono text-xs min-h-[50px]"
                                    />
                                    <div className="flex gap-1">
                                      <Textarea
                                        value={tc.expected}
                                        onChange={e => updateEditProblemTestCase(problem.id, i, "expected", e.target.value)}
                                        placeholder="stdout esperado"
                                        className="font-mono text-xs min-h-[50px] flex-1"
                                      />
                                      <Button variant="ghost" size="sm" onClick={() => removeEditProblemTestCase(problem.id, i)}>
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                                {problem.testCases.length === 0 && (
                                  <p className="text-xs text-muted-foreground italic">Sin casos de prueba.</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {/* Add new problem form */}
              <div className="space-y-3 p-3 border rounded-xl bg-muted/20">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Añadir challenge</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Título *</Label>
                    <Input value={newProbTitle} onChange={e => setNewProbTitle(e.target.value)} placeholder="Nombre del problema" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Dificultad</Label>
                    <Select value={newProbDifficulty} onValueChange={v => setNewProbDifficulty(v as "easy" | "medium" | "hard")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Fácil</SelectItem>
                        <SelectItem value="medium">Medio</SelectItem>
                        <SelectItem value="hard">Difícil</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Enunciado *</Label>
                  <Textarea
                    value={newProbStatement}
                    onChange={e => setNewProbStatement(e.target.value)}
                    placeholder="Enunciado completo del problema..."
                    className="min-h-[80px] font-mono text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-orange-600 dark:text-orange-400">Instrucciones ocultas (opcional)</Label>
                  <Textarea
                    value={newProbHidden}
                    onChange={e => setNewProbHidden(e.target.value)}
                    placeholder="Instrucción anti-trampa..."
                    className="min-h-[50px] font-mono text-xs border-orange-200 dark:border-orange-800"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Lenguajes</Label>
                  <div className="flex flex-wrap gap-1">
                    {ALL_LANGUAGE_IDS.map(id => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleEditLang(id)}
                        className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${
                          newProbLanguages.includes(id)
                            ? "bg-accent text-accent-foreground border-accent"
                            : "border-muted-foreground text-muted-foreground"
                        }`}
                      >
                        {LANGUAGE_NAMES[id]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Casos de prueba</Label>
                    <Button variant="outline" size="sm" onClick={addDraftTestCase}>
                      <Plus className="h-3 w-3 mr-1" />Añadir
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {draftTestCases.map((tc, i) => (
                      <div key={i} className="grid grid-cols-2 gap-2 items-start">
                        <Textarea
                          value={tc.input}
                          onChange={e => updateDraftTestCase(i, "input", e.target.value)}
                          placeholder="stdin"
                          className="font-mono text-xs min-h-[50px]"
                        />
                        <div className="flex gap-1">
                          <Textarea
                            value={tc.expected}
                            onChange={e => updateDraftTestCase(i, "expected", e.target.value)}
                            placeholder="stdout esperado"
                            className="font-mono text-xs min-h-[50px] flex-1"
                          />
                          {draftTestCases.length > 1 && (
                            <Button variant="ghost" size="sm" onClick={() => removeDraftTestCase(i)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <Button
                  onClick={addProblemToEdit}
                  disabled={!newProbTitle.trim() || !newProbStatement.trim()}
                  size="sm"
                  className="bg-accent hover:bg-accent/90"
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Añadir challenge
                </Button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditingComp(null)}>
                <X className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
              <Button onClick={saveEdit} disabled={isSavingEdit} className="bg-accent hover:bg-accent/90">
                {isSavingEdit ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Maze Editor Dialog */}
      <Dialog open={!!mazeEditorCompId} onOpenChange={open => !open && setMazeEditorCompId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Map className="h-5 w-5" />
              Editor de Laberinto —{" "}
              {stats?.competitions.find(c => c.id === mazeEditorCompId)?.title ?? mazeEditorCompId}
            </DialogTitle>
          </DialogHeader>
          {mazeEditorCompId && (
            <MazeEditor
              competitionId={mazeEditorCompId}
              onSaved={() => setMazeEditorCompId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
