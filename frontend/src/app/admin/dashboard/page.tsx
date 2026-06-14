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
import { Users, Trophy, Target, Plus, Eye, Lock, Map, Pencil, X } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { apiRequest } from "@/lib/api"
import { useAuth } from "@/hooks/useAuth"
import MazeEditor from "@/components/competition/maze-editor"

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
            {editingComp && (
              <div>
                <p className="text-sm text-muted-foreground">
                  Para editar problemas o el laberinto, usa los botones específicos en la lista de competencias.
                </p>
                <Link href={`/admin/create`} className="text-sm text-accent underline">
                  Crear nueva versión de la competencia
                </Link>
              </div>
            )}
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
