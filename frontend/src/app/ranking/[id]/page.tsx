"use client"

import { useState, useEffect, use } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Trophy,
  Medal,
  Crown,
  Users,
  User,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Zap,
  Target,
  Clock,
  Award,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { apiRequest } from "@/lib/api"


type Rank = {
  id: number;
  name: string;
  avatar: string; // Emoji o URL
  color: string; // Puede usarse para temas visuales
  members: string[]; // Lista de nombres completos
  points: number; // Puntos acumulados
  solves: number; // Problemas resueltos
  totalTime: string; // Formato HH:MM:SS
  lastSolve: string; // Nombre del último problema resuelto
  lastSolveTime: string; // Tiempo en que se resolvió el último problema
  achievements: string[]; // Identificadores de logros
  isLastSolver: boolean; // Si fue el último equipo en resolver
};

const achievements = {
  "💡-mente-brillante": {
    icon: "💡",
    name: "Mente brillante",
    description: "Resolvieron con genialidad, iluminando el camino."
  },
  "🐢-pero-seguro": {
    icon: "🐢",
    name: "Pero seguro",
    description: "Lento pero constante, llegaron a la meta."
  },
  "🔥-modo-fuego": {
    icon: "🔥",
    name: "Modo fuego",
    description: "En racha imparable, no hay quien los detenga."
  },
  "🧠-cerebros-en-acción": {
    icon: "🧠",
    name: "Cerebros en acción",
    description: "Pensaron fuera de la caja y lo lograron."
  },
  "🎯-tiro-perfecto": {
    icon: "🎯",
    name: "Tiro perfecto",
    description: "Envío sin errores, precisión total."
  },
  "🕵️-detectives-del-bug": {
    icon: "🕵️",
    name: "Detectives del bug",
    description: "Encontraron el fallo oculto como verdaderos sabuesos."
  },
  "🚀-despegue-explosivo": {
    icon: "🚀",
    name: "Despegue explosivo",
    description: "Fueron los primeros en resolver, ¡boom!"
  },
  "🍕-code-y-comida": {
    icon: "🍕",
    name: "Code y comida",
    description: "Codificaron sin soltar la pizza, puro flow."
  },
  "🧃-hidratados-y-eficientes": {
    icon: "🧃",
    name: "Hidratados y eficientes",
    description: "No olvidaron el juguito, energía al 100."
  },
  "🛠️-debuggers-pro": {
    icon: "🛠️",
    name: "Debuggers pro",
    description: "Arreglaron lo imposible, nivel leyenda."
  },
  "😎-nivel-jefe": {
    icon: "😎",
    name: "Nivel jefe",
    description: "Actitud de campeón, estilo imparable."
  },
  "🧘-zen-coders": {
    icon: "🧘",
    name: "Zen coders",
    description: "Serenidad bajo presión, puro equilibrio."
  },
  "🎉-fiesta-de-submissions": {
    icon: "🎉",
    name: "Fiesta de submissions",
    description: "Enviaron como locos, ¡qué ritmo!"
  },
  "🦾-sin-miedo-al-hard": {
    icon: "🦾",
    name: "Sin miedo al hard",
    description: "Se enfrentaron al reto más difícil sin titubear."
  },
  "📈-subiendo-como-la-espuma": {
    icon: "📈",
    name: "Subiendo como la espuma",
    description: "Mejora constante, siempre hacia arriba."
  },
  "🧩-rompecabezas-resuelto": {
    icon: "🧩",
    name: "Rompecabezas resuelto",
    description: "Problema complejo dominado con maestría."
  },
  "👑-reyes-del-ranking": {
    icon: "👑",
    name: "Reyes del ranking",
    description: "Lideraron la tabla, ¡coronados!"
  },
  "💪-no-se-rinden": {
    icon: "💪",
    name: "No se rinden",
    description: "Persistencia total, nunca se detienen."
  },
  "🧤-sin-mancharse": {
    icon: "🧤",
    name: "Sin mancharse",
    description: "Cero penalizaciones, juego limpio."
  },
  "🎭-drama-y-gloria": {
    icon: "🎭",
    name: "Drama y gloria",
    description: "¡Qué jornada! Emoción en cada línea."
  }
}


interface ResposeCompetition{
  title: string
  teams: number
  totalSolved: number
  resTime: string
}

export default function RankingPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params); // ✅ Desempaqueta la promesa
  const idCom = resolvedParams?.id;

  const [RanksData, setRankData] = useState<Rank[]>([])
  const [resComp, setResComp] = useState<ResposeCompetition>()
  const [viewMode, setViewMode] = useState<"Ranks" | "individual">("Ranks")
  const [showMedals, setShowMedals] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [presentationMode, setPresentationMode] = useState(false)
  const [highlightLastSolve, setHighlightLastSolve] = useState(true)
  const [lastSolveAnimation, setLastSolveAnimation] = useState<number | null>(null)
  const [reload, setReload] = useState(Boolean)

  useEffect(()=>{
    async function fetchCompetitionRanking(competitionId: string) {
      try {
        const response = await apiRequest(`/ranking/${competitionId}`, {
          method: "GET",
          token: true
        });

        console.log(RanksData)
        console.log(response.ranking)
        setRankData(response.ranking); // Devuelve la lista de equipos
        setResComp(response.competition)
      } catch (err) {
        console.error("❌ Error al cargar el ranking:", err);
        return [];
      }
    }

    fetchCompetitionRanking(idCom)
  }, [reload])

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (highlightLastSolve) {
        const lastSolver = RanksData.find((Rank) => Rank.isLastSolver)
        if (lastSolver) {
          setLastSolveAnimation(lastSolver.id)
          setTimeout(() => setLastSolveAnimation(null), 3000)
        }
      }
    }, 10000) // Every 10 seconds

    return () => clearInterval(interval)
  }, [highlightLastSolve])

  const getRankIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Crown className="h-5 w-5 text-yellow-500" />
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />
      case 3:
        return <Medal className="h-5 w-5 text-amber-600" />
      default:
        return <span className="text-lg font-bold text-muted-foreground">#{position}</span>
    }
  }

  const getRankColorClass = (color: string) => {
    const colors = {
      blue: "border-l-blue-500 bg-blue-50 dark:bg-blue-950",
      red: "border-l-red-500 bg-red-50 dark:bg-red-950",
      green: "border-l-green-500 bg-green-50 dark:bg-green-950",
      purple: "border-l-purple-500 bg-purple-50 dark:bg-purple-950",
      orange: "border-l-orange-500 bg-orange-50 dark:bg-orange-950",
    }
    return colors[color as keyof typeof colors] || "border-l-gray-500 bg-gray-50 dark:bg-gray-950"
  }

  const currentData = RanksData 

  return (
    <div className={cn("min-h-screen bg-background", presentationMode && "p-0")}>
      {/* Header */}
      {!presentationMode && (
        <div className="sticky top-16 z-40 border-b border-border bg-background/95 backdrop-blur">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Ranking en Tiempo Real</h1>
                <p className="text-muted-foreground">{resComp?.title}</p>
              </div>
              <div className="flex items-center gap-4">
                {/* View Mode Toggle */}
                <div className="flex items-center gap-2">
                  <Button
                    variant={viewMode === "Ranks" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("Ranks")}
                    className={viewMode === "Ranks" ? "bg-accent hover:bg-accent/90" : ""}
                    disabled
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Equipos
                  </Button>
                  <Button
                    variant={viewMode === "individual" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setReload(!reload)}
                    className={viewMode === "individual" ? "bg-accent hover:bg-accent/90" : ""}
                  >
                    <User className="mr-2 h-4 w-4" />
                    Actualizar
                  </Button>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch id="highlight-solve" checked={highlightLastSolve} onCheckedChange={setHighlightLastSolve} />
                    <Label htmlFor="highlight-solve" className="text-sm">
                      Resaltar último solve
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="show-medals" checked={showMedals} onCheckedChange={setShowMedals} />
                    <Label htmlFor="show-medals" className="text-sm">
                      Mostrar medallas
                    </Label>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={soundEnabled ? "" : "text-muted-foreground"}
                  >
                    {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPresentationMode(!presentationMode)}
                    className="bg-transparent"
                  >
                    {presentationMode ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                    Modo Presentación
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ranking Table */}
      <div className={cn("container mx-auto px-4 py-6", presentationMode && "px-8 py-8")}>
        <div className="space-y-4">
          {/* Stats Cards */}
          {!presentationMode && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Equipos Activos</p>
                      <p className="text-2xl font-bold">{resComp?.teams}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-accent" />
                    <div>
                      <p className="text-sm text-muted-foreground">Problemas Resueltos</p>
                      <p className="text-2xl font-bold">{resComp?.totalSolved}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Tiempo Restante</p>
                      <p className="text-2xl font-bold">{resComp?.resTime}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-yellow-500 animate-pulse" />
                    <div>
                      <p className="text-sm text-muted-foreground">Creado con pasión por</p>
                      <p className="text-base font-semibold text-primary">ComputerSociety⚙️</p>
                      <p className="text-xs text-muted-foreground italic">
                        Mao Suarez
                      </p>
                    </div>
                  </div>
                </CardContent>

              </Card>
            </div>
          )}

          {/* Ranking List */}
          <div className="space-y-3">
            {currentData.map((item, index) => {
              const position = index + 1
              const isRank = viewMode === "Ranks"
              const isHighlighted = highlightLastSolve && lastSolveAnimation === item.id

              return (
                <Card
                  key={item.id}
                  className={cn(
                    "transition-all duration-500 border-l-4",
                    isRank ? getRankColorClass((item as Rank).color) : "border-l-accent bg-accent/5",
                    isHighlighted && "animate-pulse ring-2 ring-accent shadow-lg scale-[1.02]",
                    presentationMode && "text-lg",
                  )}
                >
                  <CardContent className={cn("p-4", presentationMode && "p-6")}>
                    <div className="flex items-center justify-between">
                      {/* Rank and Rank/User Info */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-12 h-12">{getRankIcon(position)}</div>

                        <div className="flex items-center gap-3">
                          <div className={cn("text-2xl", presentationMode && "text-4xl")}>
                            {isRank ? (item as Rank).avatar : ""}
                          </div>
                          {!isRank && (
                            <Avatar className={cn("h-10 w-10", presentationMode && "h-12 w-12")}>
                              <AvatarFallback>{(item as Rank).avatar}</AvatarFallback>
                            </Avatar>
                          )}
                          <div>
                            <h3 className={cn("font-semibold", presentationMode && "text-xl")}>{item.name}</h3>
                            {isRank && (
                              <p className={cn("text-sm text-muted-foreground", presentationMode && "text-base")}>
                                {(item as Rank).members.length} miembros
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className={cn("text-2xl font-bold text-accent", presentationMode && "text-3xl")}>
                            {item.points}
                          </p>
                          <p className={cn("text-xs text-muted-foreground", presentationMode && "text-sm")}>puntos</p>
                        </div>
                        <div className="text-center">
                          <p className={cn("text-xl font-semibold", presentationMode && "text-2xl")}>{item.solves}</p>
                          <p className={cn("text-xs text-muted-foreground", presentationMode && "text-sm")}>
                            resueltos
                          </p>
                        </div>
                        <div className="text-center">
                          <p className={cn("text-sm font-mono", presentationMode && "text-base")}>{item.totalTime}</p>
                          <p className={cn("text-xs text-muted-foreground", presentationMode && "text-sm")}>tiempo</p>
                        </div>
                      </div>

                      {/* Achievements */}
                      {showMedals && item.achievements && item.achievements.length > 0 && (
                        <div className="flex items-center gap-2">
                          {item.achievements.map((achievement) => (
                            <Badge
                              key={achievement}
                              variant="outline"
                              className={cn("flex items-center gap-1 text-xs", presentationMode && "text-sm px-3 py-1")}
                              title={achievements[achievement as keyof typeof achievements]?.description}
                            >
                              <span>{achievements[achievement as keyof typeof achievements]?.icon}</span>
                              <span className="hidden sm:inline">
                                {achievements[achievement as keyof typeof achievements]?.name}
                              </span>
                            </Badge>
                          ))}
                        </div>
                      )}
                      
                    </div>

                    {/* Last Solve Info */}
                    {item.lastSolve && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>Último problema: {item.lastSolve}</span>
                          <span>Resuelto en: {item.lastSolveTime}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Presentation Mode Footer */}
          {presentationMode && (
            <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border p-4">
              <div className="container mx-auto flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-sm">
                    Actualización en tiempo real
                  </Badge>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm text-muted-foreground">En vivo</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPresentationMode(false)}
                  className="bg-transparent"
                >
                  <Minimize className="mr-2 h-4 w-4" />
                  Salir del Modo Presentación
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Achievement Legends */}
      {!presentationMode && showMedals && (
        <div className="container mx-auto px-4 pb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-yellow-500" />
                Leyenda de Logros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(achievements).map(([key, achievement]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-lg">{achievement.icon}</span>
                    <div>
                      <p className="text-sm font-medium">{achievement.name}</p>
                      <p className="text-xs text-muted-foreground">{achievement.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
