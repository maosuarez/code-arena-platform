"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Users, UserPlus, Trophy, Code, Search, Settings,
  ExternalLink, Clipboard, Eye, UserMinus, Play, Star, Sparkles, Target, Bolt } from "lucide-react"
import { LoginModal } from "@/components/auth/login-modal"
import { CreateTeamModal } from "@/components/team/create-team-modal"
import { JoinTeamModal } from "@/components/team/join-team-modal"
import { CompetitionDetailsModal } from "@/components/competition/competition-details-modal"
import { toast } from "sonner"
import { Competition } from "@/lib/types"
import { useTeamCode } from "@/hooks/useTeamCode"
import { apiRequest } from "@/lib/api"
import Link from "next/link"

export default function HomePage() {
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const [createTeamModalOpen, setCreateTeamModalOpen] = useState(false)
  const [joinTeamModalOpen, setJoinTeamModalOpen] = useState(false)
  const [competitionDetailsOpen, setCompetitionDetailsOpen] = useState(false)
  const [competitionOpen, setCompetitionOpen] = useState<Competition>()
  const [leetcodeUsername, setLeetcodeUsername] = useState("")
  const [isLeetcodeConnected, setIsLeetcodeConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [listCompetition, setListCompetition] = useState(Array<Competition>)

  const {teamCode, setTeamCode} = useTeamCode()

  const icons = [Trophy, Star, Target, Bolt]

  const handleOpen = (sample: Competition) => {
    setCompetitionDetailsOpen(true)
    setCompetitionOpen(sample)
  }

  const handleTeamCreation = () => {
    setCreateTeamModalOpen(true)
  }

  const handleJoin = async(compet: Competition) => {
    try {

      if (!teamCode){
        toast.error('Crea Primero un Equipo')
        return
      }

      await apiRequest('/competition/join', {
        method: 'POST',
        body: {
          teamCode: teamCode,
          competitionId: compet.id
        }
      })
      toast.info('Se te agrego a una Competencia')
      window.location.reload()
    } catch (error) {
      console.error("Error al dejar el equipo:", error)
      // Puedes mostrar un toast o alerta aquí si quieres
    }
  }

  const handleLeaveTeam = async () => {
    try {
      await apiRequest('/teams/delete', {
        method: 'DELETE',
        token: true
      })
    } catch (error) {
      console.error("Error al dejar el equipo:", error)
      // Puedes mostrar un toast o alerta aquí si quieres
    } finally {
      localStorage.removeItem('teamCode')
      setTeamCode('')
    }
  }

  function formatTeamCode(code: string): string {
    if (code.length !== 6) return code // Validación básica
    return `${code.slice(0, 3)}-${code.slice(3)}`
  }


  const handleSaveLeetcode = async () => {
    if (!leetcodeUsername.trim()) return

    setIsConnecting(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))

    setIsLeetcodeConnected(true)
    setIsConnecting(false)
    toast(`Tu cuenta ${leetcodeUsername} ha sido vinculada exitosamente.`)
  }

  useEffect(() => {
  const fetchCompetitions = async () => {
    try {
      const response = await apiRequest("/competition/all", { method: "GET" })

      if (!response.list || !Array.isArray(response.list)) {
        throw new Error("Respuesta inválida del servidor")
      }

      setListCompetition(response.list)
    } catch{
      toast.error("Error al cargar competiciones")
    }
  }

  fetchCompetitions()
  }, [])



  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-6 py-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-cyan-600/10 animate-pulse rounded-3xl"></div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium mb-6 animate-bounce">
            <Sparkles className="h-4 w-4" />
            Plataforma de competencias en vivo
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-balance bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 dark:from-slate-100 dark:via-blue-100 dark:to-slate-100 bg-clip-text text-transparent">
            Bienvenido a <span className="text-accent animate-pulse">CodeArena</span>
          </h1>
          <p className="text-xl text-muted-foreground text-balance max-w-2xl mx-auto leading-relaxed">
            Compite en equipos, resuelve problemas de LeetCode y demuestra tus habilidades de programación en tiempo
            real
          </p>
        </div>
      </div>

      {/* Main Action Cards */}
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {teamCode === '' ? (
          // 🟦 Tarjeta para crear equipo
          <Card className="group hover:shadow-xl transition-all duration-500 hover:scale-[1.03] hover:-translate-y-1 border-0 bg-gradient-to-br from-white to-blue-50/50 dark:from-slate-900 dark:to-blue-950/50">
            <CardHeader className="text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <Users className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl group-hover:text-accent transition-colors">Crear Equipo</CardTitle>
              <CardDescription>Forma tu equipo y personalízalo con nombre, color y avatar único</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
                size="lg"
                onClick={() => handleTeamCreation()}
              >
                <Users className="mr-2 h-4 w-4" />
                Crear Nuevo Equipo
              </Button>
            </CardContent>
          </Card>
        ) : (
          // 🟪 Tarjeta con código de equipo y opción de copiar
          <Card className="group hover:shadow-xl transition-all duration-500 hover:scale-[1.03] hover:-translate-y-1 border-0 bg-gradient-to-br from-white to-purple-50/50 dark:from-slate-900 dark:to-purple-950/50">
            <CardHeader className="text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <Clipboard className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl group-hover:text-accent transition-colors">Tu Código de Equipo</CardTitle>
              <CardDescription>Comparte este código para que otros se unan a tu equipo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-center gap-2">
                <span className="text-xl font-mono bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-md shadow-inner">
                  {formatTeamCode(teamCode)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigator.clipboard.writeText(teamCode)}
                  className="hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  Copiar
                </Button>
              </div>
              <div className="text-center pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleTeamCreation()}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Crear otro equipo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {teamCode === '' ? (
          // 🟢 Tarjeta para unirse por código
          <Card className="group hover:shadow-xl transition-all duration-500 hover:scale-[1.03] hover:-translate-y-1 border-0 bg-gradient-to-br from-white to-green-50/50 dark:from-slate-900 dark:to-green-950/50">
            <CardHeader className="text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-r from-green-500 to-cyan-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <UserPlus className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl group-hover:text-green-600 transition-colors">Unirse por Código</CardTitle>
              <CardDescription>¿Ya tienes un código de equipo? Únete en segundos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Ingresa el código del equipo"
                className="text-center text-lg font-mono border-2 focus:border-green-500 transition-colors"
                onClick={() => setJoinTeamModalOpen(true)}
              />
              <Button
                variant="outline"
                className="w-full border-2 border-green-200 hover:bg-green-50 hover:border-green-300 dark:border-green-800 dark:hover:bg-green-950 transition-all duration-300 transform hover:scale-[1.02] bg-transparent"
                size="lg"
                onClick={() => setJoinTeamModalOpen(true)}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Unirme al Equipo
              </Button>
            </CardContent>
          </Card>
        ) : (
          // 🔴 Tarjeta para salir del equipo actual
          <Card className="group hover:shadow-xl transition-all duration-500 hover:scale-[1.03] hover:-translate-y-1 border-0 bg-gradient-to-br from-white to-red-50/50 dark:from-slate-900 dark:to-red-950/50">
            <CardHeader className="text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-r from-red-500 to-orange-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <UserMinus className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl group-hover:text-red-600 transition-colors">Salir del Equipo</CardTitle>
              <CardDescription>Actualmente estás en el equipo <span className="font-mono">{formatTeamCode(teamCode)}</span></CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
                size="lg"
                onClick={() => handleLeaveTeam()}
              >
                <UserMinus className="mr-2 h-4 w-4" />
                Salir del Equipo
              </Button>
              <div className="text-center pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setJoinTeamModalOpen(true)}
                  className="text-green-600 dark:text-green-400 hover:underline"
                >
                  Unirme a otro equipo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* LeetCode Integration */}
      <Card className="max-w-2xl mx-auto hover:shadow-lg transition-all duration-300 border-0 bg-gradient-to-r from-white to-orange-50/30 dark:from-slate-900 dark:to-orange-950/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 flex items-center justify-center">
              <Code className="h-5 w-5 text-white" />
            </div>
            Vincula tu LeetCode
          </CardTitle>
          <CardDescription>Conecta tu cuenta de LeetCode para validar automáticamente tus soluciones</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Tu username de LeetCode"
              className="flex-1 border-2 focus:border-orange-500 transition-colors"
              value={leetcodeUsername}
              onChange={(e) => setLeetcodeUsername(e.target.value)}
              disabled={isLeetcodeConnected || isConnecting}
            />
            <Button
              className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 shadow-lg hover:shadow-xl transition-all duration-300 min-w-[120px]"
              onClick={handleSaveLeetcode}
              disabled={isLeetcodeConnected || !leetcodeUsername.trim() || isConnecting}
            >
              {isConnecting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Conectando...
                </>
              ) : (
                <>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {isLeetcodeConnected ? "Conectado" : "Conectar"}
                </>
              )}
            </Button>
          </div>
          <div className="text-center">
            <Badge
              variant={isLeetcodeConnected ? "default" : "outline"}
              className={
                isLeetcodeConnected
                  ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg animate-pulse"
                  : "text-muted-foreground"
              }
            >
              {isLeetcodeConnected ? `✓ LeetCode conectado (${leetcodeUsername})` : "⚠ No conectado"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Available Competitions */}
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-slate-900 to-blue-900 dark:from-slate-100 dark:to-blue-100 bg-clip-text text-transparent">
            Competencias Disponibles
          </h2>
          <p className="text-muted-foreground">Únete a las competencias activas o próximas</p>
        </div>

        <div className="grid gap-6 max-w-4xl mx-auto">
          {/* Sample Competition */}
          {listCompetition.map((competition, index) => {
            const now = new Date()
            const compDate = new Date(competition.date)
            const Icon = icons[index % icons.length] // Alternancia simple

            // Estado temporal
            let statusLabel = ""
            let statusStyle = ""
            if (competition.status === "active" && compDate <= now) {
              statusLabel = "🔴 En Vivo"
              statusStyle = "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg animate-bounce"
            } else if (compDate > now) {
              statusLabel = "🟡 Próxima"
              statusStyle = "bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-md"
            } else {
              statusLabel = "⚫ Finalizada"
              statusStyle = "bg-gradient-to-r from-slate-500 to-slate-700 text-white shadow-sm"
            }

            return (
              <Card
                key={index}
                className="hover:shadow-xl transition-all duration-500 hover:scale-[1.02] border-0 bg-gradient-to-r from-white to-yellow-50/30 dark:from-slate-900 dark:to-yellow-950/30 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-400/20 to-orange-500/20 rounded-full -translate-y-16 translate-x-16"></div>

                <CardHeader className="relative z-10">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-yellow-500 to-orange-600 flex items-center justify-center animate-pulse">
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        {competition.title}
                      </CardTitle>
                      <CardDescription className="mt-2 text-base">
                        {competition.description}
                      </CardDescription>
                    </div>

                    <Badge className={statusStyle}>{statusLabel}</Badge>
                  </div>
                </CardHeader>

                <CardContent className="relative z-10">
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge variant="outline" className="border-yellow-200 text-yellow-700 dark:border-yellow-800 dark:text-yellow-300">
                      👥 {competition.teams} equipos
                    </Badge>
                    <Badge variant="outline" className="border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-300">
                      🧩 {competition.problems.length} problemas
                    </Badge>
                    <Badge variant="outline" className="border-red-200 text-red-700 dark:border-red-800 dark:text-red-300 animate-pulse">
                      📅 {compDate.toLocaleDateString("es-CO", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                    </Badge>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpen(competition)}
                      className="hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-950 transition-all duration-300"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Ver Detalles
                    </Button>
                    {
                      teamCode && competition.teams.includes(teamCode) ? (
                        <div
                          className="flex items-center justify-center size-sm bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 font-medium rounded-xl px-4 py-2 shadow-md"
                        >
                          Ya estás inscrito
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleJoin(competition)}
                          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 rounded-xl px-4 py-2"
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Unirme Ahora
                        </Button>
                      )
                    }

                    <Link href={`/competition/${competition.id}`} passHref>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300"
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        Administrar
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Problem Explorer */}
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-slate-900 to-purple-900 dark:from-slate-100 dark:to-purple-100 bg-clip-text text-transparent">
            Explorar Problemas
          </h2>
          <p className="text-muted-foreground">Practica con problemas de LeetCode organizados por dificultad</p>
        </div>

        <Card className="max-w-4xl mx-auto hover:shadow-lg transition-all duration-300 border-0 bg-gradient-to-r from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-800/50">
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar problemas por nombre, etiqueta o dificultad..."
                  className="w-full pl-10 border-2 focus:border-purple-500 transition-colors"
                />
              </div>
              <Button
                variant="outline"
                className="bg-gradient-to-r from-purple-600 to-blue-600 text-white border-0 hover:from-purple-700 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Search className="mr-2 h-4 w-4" />
                Buscar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 justify-center">
              <Button
                variant="outline"
                className="text-green-600 border-2 border-green-200 hover:bg-green-50 hover:border-green-300 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950 bg-transparent transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg"
              >
                <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                Fácil (234)
              </Button>
              <Button
                variant="outline"
                className="text-yellow-600 border-2 border-yellow-200 hover:bg-yellow-50 hover:border-yellow-300 dark:text-yellow-400 dark:border-yellow-800 dark:hover:bg-yellow-950 bg-transparent transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg"
              >
                <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                Medio (567)
              </Button>
              <Button
                variant="outline"
                className="text-red-600 border-2 border-red-200 hover:bg-red-50 hover:border-red-300 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950 bg-transparent transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg"
              >
                <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                Difícil (189)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <LoginModal open={loginModalOpen} onOpenChange={setLoginModalOpen} />
      <CreateTeamModal open={createTeamModalOpen} onOpenChange={setCreateTeamModalOpen} />
      <JoinTeamModal open={joinTeamModalOpen} onOpenChange={setJoinTeamModalOpen} />
      <CompetitionDetailsModal
        open={competitionDetailsOpen}
        onOpenChange={setCompetitionDetailsOpen}
        competition={competitionOpen}
      />
    </div>
  )
}
