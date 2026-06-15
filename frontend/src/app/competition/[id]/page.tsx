"use client"

import { useState, useEffect, use, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Trophy,
  Play,
  CheckCircle,
  AlertCircle,
  Filter,
  EyeOff,
  Users,
  UserPlus,
  Target,
  Award,
  BookOpen,
  ArrowLeft,
  Map,
  Code,
  X,
  Copy,
  Flag,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import Link from "next/link"
import { Competition, Problem, MazeState, LANGUAGE_NAMES } from "@/lib/types"
import { apiRequest } from "@/lib/api"
import { Submission } from "@/lib/types"
import { useCompetitionSocket } from "@/hooks/useCompetitionSocket"
import MazeView from "@/components/competition/maze-view"

/**
 * Renders a problem statement with the hidden anti-cheat instructions injected
 * as invisible text in the middle. The text is zero-opacity and zero-size but
 * remains selectable, so it is included when the user copies the problem text.
 */
function ProblemStatementWithHidden({ problem }: { problem: Problem }) {
  const { statement, hidden_instructions } = problem
  if (!hidden_instructions) {
    return <p className="text-sm leading-relaxed whitespace-pre-wrap">{statement}</p>
  }
  const mid = Math.floor(statement.length / 2)
  const firstHalf = statement.slice(0, mid)
  const secondHalf = statement.slice(mid)
  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap">
      {firstHalf}
      <span
        aria-hidden="false"
        style={{
          opacity: 0,
          fontSize: 0,
          position: "absolute",
          userSelect: "text",
          pointerEvents: "none",
        }}
      >
        {hidden_instructions}
      </span>
      {secondHalf}
    </p>
  )
}

export default function CompetitionPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const idCom = resolvedParams?.id

  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) router.replace("/")
  }, [isAuthenticated, authLoading, router])

  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [timerStatus, setTimerStatus] = useState<"not_started" | "active" | "ended">("active")
  const [filteredProblems, setFilteredProblems] = useState<Problem[]>([])
  const [difficultyFilter, setDifficultyFilter] = useState("all")
  const [hideCompleted, setHideCompleted] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [rulesModalOpen, setRulesModalOpen] = useState(false)
  const [competitionData, setCompetitionData] = useState<Competition>({} as Competition)
  const [problems, setProblems] = useState<Problem[]>([])
  const [members, setMembers] = useState<{ id: string; username: string; leetcode: string }[]>([])
  const [teamPoints, setTeamPoints] = useState(0)
  const [teamRanking, setTeamRanking] = useState<number | null>(null)
  const [totalTeams, setTotalTeams] = useState(0)
  const [teamName, setTeamName] = useState("")
  const [myTeamCode, setMyTeamCode] = useState("")
  const [avatar, setAvatar] = useState("")
  const [submissions, setSubmissions] = useState<Submission[]>([])

  // Code submission dialog
  const [activeProblem, setActiveProblem] = useState<Problem | null>(null)
  const [sourceCode, setSourceCode] = useState("")
  const [languageId, setLanguageId] = useState(71)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{ ok: boolean; msg: string } | null>(null)

  // Maze
  const [mazeState, setMazeState] = useState<MazeState | null>(null)
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [activeTab, setActiveTab] = useState("problems")
  const [winner, setWinner] = useState<{ teamCode: string; teamName: string } | null>(null)
  const [podium, setPodium] = useState<{ teamCode: string; teamName: string }[]>([])

  useCompetitionSocket(idCom, (msg) => {
    if (msg.event === "new_submission" && msg.data.teamCode === myTeamCode) {
      const sub = msg.data as unknown as Submission
      setSubmissions((prev) => {
        const alreadyExists = prev.some(s => s.problem === sub.problem && s.member === sub.member)
        return alreadyExists ? prev : [...prev, sub]
      })
      setTeamPoints((prev) => prev + (msg.data.points as number))
      toast.success(`¡${msg.data.member} resolvió un problema! +${msg.data.points} pts`)
    }

    if (msg.event === "door_unlocked") {
      // Refresh maze state when any team unlocks a door
      fetchMazeState()
      if (msg.data.teamCode === myTeamCode) {
        toast.success(`Puerta abierta! Avanzaste al siguiente nodo.`)
      } else {
        toast(`Equipo rival abrió una puerta.`)
      }
    }

    if (msg.event === "team_finished") {
      // Un equipo llegó a la meta y tomó un lugar del podio (el juego sigue).
      const place = Number(msg.data.position)
      const medal = place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉"
      if (msg.data.teamCode === myTeamCode) {
        toast.success(`${medal} ¡Tu equipo llegó a la meta! Puesto ${place} del podio.`)
      } else {
        toast(`${medal} ${msg.data.teamName} llegó a la meta (puesto ${place}).`)
      }
    }

    if (msg.event === "game_over") {
      // El podio (top 3) se completó: el juego terminó para todos.
      const pod = Array.isArray(msg.data.podium)
        ? (msg.data.podium as { teamCode: string; teamName: string }[])
        : []
      setPodium(pod)
      setWinner({ teamCode: String(msg.data.teamCode), teamName: String(msg.data.teamName) })
      setCompetitionData(prev => ({ ...prev, status: "completed" }))
      setTimerStatus("ended")
      const mine = pod.find(p => p.teamCode === myTeamCode)
      if (mine) {
        const place = pod.indexOf(mine) + 1
        toast.success(`🏆 ¡Podio completo! Tu equipo quedó en el puesto ${place}.`)
      } else {
        toast(`🏁 Juego terminado. Ganó ${msg.data.teamName}.`)
      }
    }
  })

  function computeTimerState(competition: Competition, now: Date = new Date()): { status: "not_started" | "active" | "ended"; secondsLeft: number } {
    // Prefer explicit start_time/end_time fields; fall back to date + duration
    const startMs = competition.start_time
      ? new Date(competition.start_time).getTime()
      : new Date(competition.date).getTime()
    const endMs = competition.end_time
      ? new Date(competition.end_time).getTime()
      : startMs + (competition.duration ?? 0) * 60 * 1000

    const nowMs = now.getTime()
    if (nowMs < startMs) {
      return { status: "not_started", secondsLeft: Math.floor((startMs - nowMs) / 1000) }
    }
    if (nowMs > endMs) {
      return { status: "ended", secondsLeft: 0 }
    }
    return { status: "active", secondsLeft: Math.floor((endMs - nowMs) / 1000) }
  }

  function getEmojiForUser(username: string) {
    const faces = ["😄", "😎", "🤓", "🧐", "😺", "👾", "🤖", "🐸", "🧠", "👽"]
    const idx = username.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % faces.length
    return faces[idx]
  }

  const fetchMazeState = useCallback(async () => {
    try {
      const res = await apiRequest(`/maze/${idCom}/state`, { method: "GET" })
      setMazeState(res as MazeState)
    } catch {
      // Maze not configured yet — silently ignore
    }
  }, [idCom])

  useEffect(() => {
    let isMounted = true
    const fetchCompetitionPrivate = async () => {
      try {
        const res = await apiRequest(`/competition/private/${idCom}`, { method: "GET", token: true })
        const { competition, team } = res
        if (!competition) throw new Error("Competición no encontrada")
        if (isMounted) {
          setCompetitionData(competition)
          setProblems(competition.problems || [])
          if (competition.status === "completed" && competition.winner) {
            setWinner({ teamCode: competition.winner, teamName: competition.winnerName || competition.winner })
          }
          if (Array.isArray(competition.podium)) {
            setPodium(competition.podium)
          }
          const ts = computeTimerState(competition)
          setTimerStatus(ts.status)
          setTimeLeft(ts.secondsLeft)
          const teamInfo = team?.team
          if (teamInfo) {
            setMembers(teamInfo.members || [])
            setSubmissions(teamInfo.submissions || [])
            setTeamPoints(teamInfo.points || 0)
            setTeamRanking(teamInfo.ranking || null)
            setTotalTeams(teamInfo.totalTeams || 0)
            setTeamName(teamInfo.name || "")
            setMyTeamCode(teamInfo.code || "")
            setAvatar(teamInfo.avatar || "")
          }
        }
      } catch (error) {
        console.error("Error al cargar competición:", error)
      }
    }
    if (idCom) {
      fetchCompetitionPrivate()
      fetchMazeState()
    }
    return () => { isMounted = false }
  }, [idCom, fetchMazeState])

  // Refresh maze available points locally when team points change
  useEffect(() => {
    if (!myTeamCode) return
    setMazeState(prev => {
      if (!prev) return prev
      return {
        ...prev,
        teams: prev.teams.map(t =>
          t.teamCode === myTeamCode
            ? { ...t, earnedPoints: teamPoints, availablePoints: teamPoints - t.spentPoints }
            : t
        )
      }
    })
  }, [teamPoints, myTeamCode])

  useEffect(() => {
    if (!competitionData.date) return
    const timer = setInterval(() => {
      const ts = computeTimerState(competitionData)
      setTimerStatus(ts.status)
      setTimeLeft(ts.secondsLeft)
    }, 1000)
    return () => clearInterval(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionData])

  useEffect(() => {
    let filtered = problems
    if (difficultyFilter !== "all") filtered = filtered.filter(p => p.difficulty === difficultyFilter)
    if (hideCompleted) {
      const ids = submissions.map(s => s.problem)
      filtered = filtered.filter(p => !ids.includes(p.id))
    }
    if (searchQuery) filtered = filtered.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()))
    setFilteredProblems(filtered)
  }, [difficultyFilter, hideCompleted, searchQuery, submissions, problems])

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return "--:--:--"
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }

  const getProgressPercentage = () => {
    if (timeLeft === null) return 0
    const total = competitionData.duration * 60
    return Math.min(100, ((total - timeLeft) / total) * 100)
  }

  const openProblem = (problem: Problem) => {
    setActiveProblem(problem)
    setSourceCode("")
    setSubmitResult(null)
    // Default to first supported language
    if (problem.language_ids?.length > 0) setLanguageId(problem.language_ids[0])
  }

  async function submitCode() {
    if (!activeProblem) return
    if (!sourceCode.trim()) {
      toast.error("Escribe tu solución antes de enviar")
      return
    }
    setIsSubmitting(true)
    setSubmitResult(null)
    try {
      const response = await apiRequest(
        `/competition/submission/${idCom}/${activeProblem.id}`,
        {
          method: "POST",
          token: true,
          body: { source_code: sourceCode, language_id: languageId },
        }
      )
      setSubmissions(prev => [...prev, response.submission])
      setTeamPoints(prev => prev + response.submission.points)
      setSubmitResult({ ok: true, msg: `¡AC! +${response.submission.points} puntos` })
      toast.success(`¡AC! +${response.submission.points} puntos`)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Error al enviar solución"
      setSubmitResult({ ok: false, msg })
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleUnlockDoor(doorId: string) {
    setIsUnlocking(true)
    try {
      await apiRequest(`/maze/${idCom}/unlock`, {
        method: "POST",
        token: true,
        body: { door_id: doorId },
      })
      await fetchMazeState()
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Error al abrir puerta"
      toast.error(msg)
    } finally {
      setIsUnlocking(false)
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy": return "text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:border-green-800 dark:bg-green-950"
      case "medium": return "text-yellow-600 border-yellow-200 bg-yellow-50 dark:text-yellow-400 dark:border-yellow-800 dark:bg-yellow-950"
      case "hard": return "text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-800 dark:bg-red-950"
      default: return "text-muted-foreground"
    }
  }

  const difficultyLabel = (d: string) => d === "easy" ? "Fácil" : d === "medium" ? "Medio" : "Difícil"

  const getStatusIcon = (problemId: string) =>
    submissions.some(s => s.problem === problemId)
      ? <CheckCircle className="h-4 w-4 text-green-500" />
      : <AlertCircle className="h-4 w-4 text-muted-foreground" />

  function getProblemTitleById(id: string) {
    return problems.find(p => p.id === id)?.title ?? id
  }

  const cheereTeam = () => {
    const phrases = [
      `🔥 ¡${teamName} va con toda!`,
      `🚀 ¡A romperla ${teamName}!`,
      `🏆 ¡Vamos ${teamName}, el podio los espera!`,
      `💪 ¡Código limpio, mente afilada: ${teamName}!`,
    ]
    toast(phrases[Math.floor(Math.random() * phrases.length)])
  }

  const isSolved = (id: string) => submissions.some(s => s.problem === id)

  const isUrgent = timerStatus === "active" && timeLeft !== null && timeLeft <= 300 // last 5 minutes
  const isCritical = timerStatus === "active" && timeLeft !== null && timeLeft <= 60 // last 1 minute

  return (
    <div className="min-h-screen bg-background">
      {winner && (
        <div className="bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-center py-2 px-4 font-semibold flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <span className="flex items-center gap-2"><Flag className="h-4 w-4" /> Juego terminado — Podio:</span>
          {podium.length > 0
            ? podium.map((p, i) => (
                <span key={p.teamCode} className={p.teamCode === myTeamCode ? "underline" : ""}>
                  {(i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉")} {p.teamName}
                </span>
              ))
            : <span>🥇 {winner.teamName}</span>}
        </div>
      )}
      {/* Status Bar */}
      <div className={`sticky top-16 z-40 border-b border-border backdrop-blur transition-colors duration-500 ${
        isCritical
          ? "bg-red-950/95 border-red-800"
          : isUrgent
          ? "bg-amber-950/95 border-amber-800"
          : "bg-background/95"
      }`}>
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between gap-4">
            {/* Left: back + title */}
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/")}
                className={`rounded-xl shrink-0 ${isCritical || isUrgent ? "text-white/80 hover:text-white hover:bg-white/10" : ""}`}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className={`text-sm font-semibold truncate ${isCritical || isUrgent ? "text-white" : ""}`}>
                {competitionData.title}
              </h1>
            </div>

            {/* Center: dominant timer */}
            <div className="flex flex-col items-center shrink-0">
              <div className={`font-mono font-bold tabular-nums leading-none transition-all duration-300 ${
                isCritical
                  ? "text-3xl text-red-300 animate-pulse"
                  : isUrgent
                  ? "text-3xl text-amber-300"
                  : timerStatus === "ended"
                  ? "text-2xl text-slate-400"
                  : timerStatus === "not_started"
                  ? "text-2xl text-yellow-400"
                  : "text-2xl text-foreground"
              }`}>
                {timerStatus === "ended" ? "Finalizado" : timerStatus === "not_started" ? "No iniciado" : formatTime(timeLeft)}
              </div>
              <p className={`text-[10px] uppercase tracking-widest mt-0.5 ${
                isCritical ? "text-red-400" : isUrgent ? "text-amber-400" : "text-muted-foreground"
              }`}>
                {isCritical ? "TIEMPO CRITICO" : isUrgent ? "CASI TERMINA" : timerStatus === "ended" ? "competencia terminada" : timerStatus === "not_started" ? "inicia en" : "tiempo restante"}
              </p>
            </div>

            {/* Right: team points pill + ranking link + rules */}
            <div className="flex items-center gap-2 shrink-0">
              <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold ${
                isCritical || isUrgent
                  ? "bg-white/10 border-white/20 text-white"
                  : "bg-accent/10 border-accent/30 text-accent"
              }`}>
                <Trophy className="h-3.5 w-3.5" />
                <span>{teamPoints} pts</span>
                {teamRanking && (
                  <span className={`text-xs font-normal pl-1 border-l ${isCritical || isUrgent ? "border-white/20 text-white/70" : "border-accent/20 text-muted-foreground"}`}>
                    #{teamRanking}
                  </span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                asChild
                className={isCritical || isUrgent ? "border-white/20 text-white bg-white/10 hover:bg-white/20" : ""}
              >
                <Link href={`/ranking/${idCom}`}>
                  <Award className="mr-1.5 h-3.5 w-3.5" />
                  Ranking
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRulesModalOpen(true)}
                className={isCritical || isUrgent ? "text-white/70 hover:text-white hover:bg-white/10" : ""}
              >
                <BookOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Main content with tabs */}
          <div className="lg:col-span-3">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="problems" className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Problemas
                </TabsTrigger>
                <TabsTrigger value="maze" className="flex items-center gap-2">
                  <Map className="h-4 w-4" />
                  Laberinto
                  {mazeState && (
                    <Badge variant="outline" className="ml-1 text-xs py-0">
                      {mazeState.teams.find(t => t.teamCode === myTeamCode)?.availablePoints ?? teamPoints} pts
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="problems" className="space-y-4">
                {/* Controls */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1">
                        <Input
                          placeholder="Buscar problemas..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Filter className="mr-2 h-4 w-4" />
                              Filtrar
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => setDifficultyFilter("all")}>Todos</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDifficultyFilter("easy")}>Fácil</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDifficultyFilter("medium")}>Medio</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDifficultyFilter("hard")}>Difícil</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          variant="outline" size="sm"
                          onClick={() => setHideCompleted(!hideCompleted)}
                          className={hideCompleted ? "bg-accent text-accent-foreground" : ""}
                        >
                          <EyeOff className="mr-2 h-4 w-4" />
                          Ocultar Resueltos
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {/* Problem list */}
                <div className="space-y-2">
                  {filteredProblems.map(problem => {
                    const solved = isSolved(problem.id)
                    const pts = competitionData.scoring?.[problem.difficulty]
                    return (
                      <Card
                        key={problem.id}
                        className={`transition-all duration-150 ${
                          solved
                            ? "border-green-500/40 bg-green-500/5 opacity-75"
                            : "hover:shadow-md hover:border-accent/40 cursor-pointer"
                        }`}
                        onClick={() => !solved && openProblem(problem)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            {/* Status icon */}
                            <div className="shrink-0">
                              {solved
                                ? <CheckCircle className="h-5 w-5 text-green-500" />
                                : <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                              }
                            </div>

                            {/* Title + meta */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`font-semibold text-sm ${solved ? "line-through text-muted-foreground" : ""}`}>
                                  {problem.title}
                                </span>
                                <Badge className={`text-xs shrink-0 ${getDifficultyColor(problem.difficulty)}`}>
                                  {difficultyLabel(problem.difficulty)}
                                </Badge>
                              </div>
                              {!solved && (
                                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                  {problem.statement?.slice(0, 90)}
                                </p>
                              )}
                            </div>

                            {/* Points + CTA */}
                            <div className="shrink-0 flex items-center gap-3">
                              <div className="text-right">
                                <div className={`text-base font-black tabular-nums ${solved ? "text-green-600" : "text-accent"}`}>
                                  {pts}
                                </div>
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">pts</div>
                              </div>
                              {!solved && (
                                <Button
                                  size="sm"
                                  className="bg-accent hover:bg-accent/90 h-8 px-3 shrink-0"
                                  onClick={e => { e.stopPropagation(); openProblem(problem) }}
                                >
                                  <Play className="h-3.5 w-3.5 mr-1" />
                                  Resolver
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </TabsContent>

              <TabsContent value="maze">
                <MazeView
                  mazeState={mazeState}
                  myTeamCode={myTeamCode}
                  onUnlockDoor={handleUnlockDoor}
                  isUnlocking={isUnlocking}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Team Score */}
            <Card className="border-accent/30 bg-accent/5">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold truncate">
                    {avatar} {teamName}
                  </CardTitle>
                  {teamRanking && (
                    <Badge
                      className={`text-xs shrink-0 ${
                        teamRanking === 1
                          ? "bg-yellow-500 text-yellow-950"
                          : teamRanking <= 3
                          ? "bg-orange-500/20 text-orange-600 border-orange-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      #{teamRanking}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Points — dominant display */}
                <div className="text-center py-2">
                  <div className="text-4xl font-black text-accent tabular-nums leading-none">{teamPoints}</div>
                  <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">puntos</p>
                </div>

                {/* Position context */}
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-muted-foreground">Posición</span>
                  <span className="font-semibold">
                    {teamRanking ? `${teamRanking} de ${totalTeams}` : "—"}
                  </span>
                </div>

                {/* Problem progress */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs px-1">
                    <span className="text-muted-foreground">Problemas</span>
                    <span className="font-semibold">{submissions.length} / {problems.length}</span>
                  </div>
                  <Progress
                    value={(submissions.length / Math.max(problems.length, 1)) * 100}
                    className="h-2"
                  />
                </div>

                {/* Maze available points */}
                {mazeState && myTeamCode && (() => {
                  const myMazeTeam = mazeState.teams.find(t => t.teamCode === myTeamCode)
                  if (!myMazeTeam) return null
                  return (
                    <div className="flex items-center justify-between text-xs px-1 pt-1 border-t border-border">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Map className="h-3 w-3" />
                        Pts laberinto
                      </span>
                      <span className="font-semibold text-amber-600">{myMazeTeam.availablePoints}</span>
                    </div>
                  )
                })()}
              </CardContent>
            </Card>

            {/* Submission History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Target className="h-4 w-4 text-accent" />
                  Historial
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-40">
                  <div className="space-y-2">
                    {submissions.map((sub, i) => (
                      <div key={`${sub.problem}-${i}`} className="flex items-center gap-2 p-1.5 rounded bg-muted/50">
                        <div className={`w-2 h-2 rounded-full ${sub.status === "AC" ? "bg-green-500" : "bg-red-500"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{getProblemTitleById(sub.problem)}</p>
                          <p className="text-xs text-muted-foreground">{sub.member}</p>
                        </div>
                        <Badge variant="outline" className="text-xs py-0 shrink-0">
                          +{sub.points}
                        </Badge>
                      </div>
                    ))}
                    {submissions.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">Sin envíos aún</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Team Members */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-accent" />
                  Equipo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {members.map(member => (
                    <div key={member.id} className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-xs">{getEmojiForUser(member.username)}</AvatarFallback>
                      </Avatar>
                      <p className="text-sm truncate">{member.username}</p>
                    </div>
                  ))}
                  <Separator />
                  <Button variant="outline" size="sm" className="w-full bg-transparent" onClick={cheereTeam}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Animar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Quick-switch pill: visible on mobile only where the tab bar may be off-screen */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 sm:hidden">
        <div className="flex items-center gap-1 bg-background/95 border rounded-full shadow-lg px-2 py-1.5 backdrop-blur">
          <Button
            size="sm"
            variant={activeTab === "problems" ? "default" : "ghost"}
            className="rounded-full h-8 px-3 text-xs"
            onClick={() => setActiveTab("problems")}
          >
            <Code className="h-3.5 w-3.5 mr-1" />
            Problemas
          </Button>
          <Button
            size="sm"
            variant={activeTab === "maze" ? "default" : "ghost"}
            className="rounded-full h-8 px-3 text-xs"
            onClick={() => setActiveTab("maze")}
          >
            <Map className="h-3.5 w-3.5 mr-1" />
            Laberinto
          </Button>
        </div>
      </div>

      {/* Code submission dialog */}
      {activeProblem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-6">
          <div className="bg-background border rounded-xl shadow-2xl w-full max-w-4xl h-full max-h-[92vh] flex flex-col">

            {/* Header — always visible */}
            <div className="flex items-center gap-3 p-4 border-b shrink-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold truncate">{activeProblem.title}</h2>
                  <Badge className={`text-xs shrink-0 ${getDifficultyColor(activeProblem.difficulty)}`}>
                    {difficultyLabel(activeProblem.difficulty)}
                  </Badge>
                  <span className="text-sm font-bold text-accent shrink-0">
                    +{competitionData.scoring?.[activeProblem.difficulty]} pts
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setActiveProblem(null)} className="shrink-0">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Result banner — sticky below header when present */}
            {submitResult && (
              <div className={`flex items-center gap-3 px-4 py-3 text-sm font-semibold border-b shrink-0 ${
                submitResult.ok
                  ? "bg-green-500/15 text-green-700 border-green-500/30 dark:text-green-300"
                  : "bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-300"
              }`}>
                {submitResult.ok
                  ? <CheckCircle className="h-5 w-5 shrink-0 text-green-500" />
                  : <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
                }
                <span className="whitespace-pre-wrap">{submitResult.msg}</span>
              </div>
            )}

            {/* Two-panel body */}
            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row min-h-0">

              {/* Left: problem statement */}
              <div className="lg:w-2/5 border-b lg:border-b-0 lg:border-r flex flex-col min-h-0">
                <div className="px-4 pt-3 pb-2 shrink-0 flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Enunciado</h3>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(activeProblem.statement).then(() => toast.success("Copiado"))
                    }}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted/60"
                  >
                    <Copy className="h-3 w-3" />
                    Copiar
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                  <ProblemStatementWithHidden problem={activeProblem} />
                </div>
              </div>

              {/* Right: code editor */}
              <div className="lg:w-3/5 flex flex-col min-h-0">
                <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tu solución</h3>
                  <Select
                    value={String(languageId)}
                    onValueChange={v => setLanguageId(Number(v))}
                  >
                    <SelectTrigger className="h-7 w-40 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(activeProblem.language_ids ?? [71]).map(id => (
                        <SelectItem key={id} value={String(id)} className="text-xs">
                          {LANGUAGE_NAMES[id] ?? `Language ${id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 px-4 pb-4 min-h-0">
                  <textarea
                    className="w-full h-full min-h-[200px] font-mono text-sm bg-muted/40 border rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder={`# Escribe tu solución en ${LANGUAGE_NAMES[languageId] ?? "el lenguaje seleccionado"}\n`}
                    value={sourceCode}
                    onChange={e => setSourceCode(e.target.value)}
                    spellCheck={false}
                    autoFocus
                  />
                </div>
              </div>
            </div>

            {/* Footer — always visible */}
            <div className="flex items-center justify-between gap-3 p-4 border-t shrink-0">
              <Button variant="ghost" size="sm" onClick={() => setActiveProblem(null)} className="text-muted-foreground">
                Cerrar
              </Button>
              <Button
                size="default"
                className={`min-w-36 font-semibold transition-all ${
                  isSolved(activeProblem.id)
                    ? "bg-green-600 hover:bg-green-600 cursor-default"
                    : "bg-accent hover:bg-accent/90"
                }`}
                disabled={isSubmitting || isSolved(activeProblem.id)}
                onClick={submitCode}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Evaluando...
                  </span>
                ) : isSolved(activeProblem.id) ? (
                  <><CheckCircle className="mr-2 h-4 w-4" />Ya resuelto</>
                ) : (
                  <><Play className="mr-2 h-4 w-4" />Enviar solución</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rules Modal */}
      <Dialog open={rulesModalOpen} onOpenChange={setRulesModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reglas de la Competencia</DialogTitle>
            <DialogDescription>Normas y condiciones del torneo</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm">
            {(competitionData.rules ?? []).map((rule, i) => (
              <li key={i}>• {rule}</li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  )
}
