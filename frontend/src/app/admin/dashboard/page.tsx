"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Play,
  Pause,
  Trophy,
  Download,
  RotateCcw,
  Eye,
  Edit,
  Trash2,
  Plus,
  Users,
  FileText,
  Clock,
  Target,
} from "lucide-react"
import Link from "next/link"

interface Competition {
  id: string
  title: string
  description: string
  status: "draft" | "active" | "paused" | "finished"
  startTime: string
  endTime: string
  participants: number
  problems: number
  totalSubmissions: number
  createdAt: string
}

const competitions: Competition[] = [
  {
    id: "1",
    title: "Torneo Semanal - Algoritmos Básicos",
    description: "Competencia de 2 horas con problemas de dificultad Easy y Medium",
    status: "active",
    startTime: "2024-01-15 14:00",
    endTime: "2024-01-15 16:00",
    participants: 15,
    problems: 6,
    totalSubmissions: 42,
    createdAt: "2024-01-10",
  },
  {
    id: "2",
    title: "Campeonato Mensual - Estructuras de Datos",
    description: "Competencia avanzada de 3 horas con problemas Medium y Hard",
    status: "draft",
    startTime: "2024-01-20 15:00",
    endTime: "2024-01-20 18:00",
    participants: 0,
    problems: 8,
    totalSubmissions: 0,
    createdAt: "2024-01-12",
  },
  {
    id: "3",
    title: "Sprint de Fin de Semana",
    description: "Competencia rápida de 1 hora con problemas variados",
    status: "finished",
    startTime: "2024-01-08 10:00",
    endTime: "2024-01-08 11:00",
    participants: 23,
    problems: 4,
    totalSubmissions: 67,
    createdAt: "2024-01-05",
  },
]

export default function AdminDashboard() {
  const [isLoading, setIsLoading] = useState<string | null>(null)

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "draft":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "paused":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      case "finished":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "Activa"
      case "draft":
        return "Borrador"
      case "paused":
        return "Pausada"
      case "finished":
        return "Finalizada"
      default:
        return "Desconocido"
    }
  }

  const handleAction = async (action: string, competitionId: string) => {
    setIsLoading(competitionId)

    try {
      // Simular llamada a API
      await new Promise((resolve) => setTimeout(resolve, 1000))

      switch (action) {
        case "start":
          toast("La competencia ha comenzado exitosamente.")
          break
        case "pause":
          toast("La competencia ha sido pausada.")
          break
        case "finish":
          toast("La competencia ha finalizado y se ha generado el podio.")
          break
        case "export":
          toast("Los resultados se han descargado en formato CSV.")
          break
        case "reset":
          toast( "El marcador ha sido reiniciado exitosamente.")
          break
        case "delete":
          toast("La competencia ha sido eliminada permanentemente.")
          break
      }
    } catch (error) {
      toast("Ha ocurrido un error al procesar la acción.")
      console.log(error)
    } finally {
      setIsLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Panel de Administración</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">Gestiona tus competencias de coding</p>
          </div>
          <Link href="/admin/create">
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Competencia
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Competencias</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{competitions.length}</div>
              <p className="text-xs text-muted-foreground">+2 desde el mes pasado</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Participantes Activos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{competitions.reduce((acc, comp) => acc + comp.participants, 0)}</div>
              <p className="text-xs text-muted-foreground">+12% desde la semana pasada</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Envíos Totales</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {competitions.reduce((acc, comp) => acc + comp.totalSubmissions, 0)}
              </div>
              <p className="text-xs text-muted-foreground">+8% desde ayer</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Competencias Activas</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{competitions.filter((comp) => comp.status === "active").length}</div>
              <p className="text-xs text-muted-foreground">En tiempo real</p>
            </CardContent>
          </Card>
        </div>

        {/* Competitions List */}
        <div className="space-y-6">
          {competitions.map((competition) => (
            <Card key={competition.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle className="text-xl">{competition.title}</CardTitle>
                      <Badge className={getStatusColor(competition.status)}>{getStatusText(competition.status)}</Badge>
                    </div>
                    <CardDescription className="text-base">{competition.description}</CardDescription>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {competition.status === "draft" && (
                      <Button
                        size="sm"
                        onClick={() => handleAction("start", competition.id)}
                        disabled={isLoading === competition.id}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Iniciar
                      </Button>
                    )}

                    {competition.status === "active" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAction("pause", competition.id)}
                          disabled={isLoading === competition.id}
                        >
                          <Pause className="w-4 h-4 mr-1" />
                          Pausar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleAction("finish", competition.id)}
                          disabled={isLoading === competition.id}
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          <Trophy className="w-4 h-4 mr-1" />
                          Finalizar
                        </Button>
                      </>
                    )}

                    {competition.status === "paused" && (
                      <Button
                        size="sm"
                        onClick={() => handleAction("start", competition.id)}
                        disabled={isLoading === competition.id}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Reanudar
                      </Button>
                    )}

                    <Link href={`/ranking/${competition.id}`}>
                      <Button size="sm" variant="outline">
                        <Eye className="w-4 h-4 mr-1" />
                        Ver Ranking
                      </Button>
                    </Link>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction("export", competition.id)}
                      disabled={isLoading === competition.id}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Exportar
                    </Button>

                    {competition.status !== "active" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAction("reset", competition.id)}
                          disabled={isLoading === competition.id}
                        >
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Reiniciar
                        </Button>

                        <Button size="sm" variant="outline">
                          <Edit className="w-4 h-4 mr-1" />
                          Editar
                        </Button>

                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleAction("delete", competition.id)}
                          disabled={isLoading === competition.id}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Eliminar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Inicio</p>
                    <p className="font-medium">{competition.startTime}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Fin</p>
                    <p className="font-medium">{competition.endTime}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Participantes</p>
                    <p className="font-medium">{competition.participants}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Problemas</p>
                    <p className="font-medium">{competition.problems}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Envíos</p>
                    <p className="font-medium">{competition.totalSubmissions}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
