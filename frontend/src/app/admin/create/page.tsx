"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Calendar,
  Trophy,
  Target,
  Users,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Settings,
  HelpCircle,
  Award,
} from "lucide-react"
import { toast } from "sonner"
import { Competition, Problem } from "@/lib/types"
import { apiRequest } from "@/lib/api"
import { redirect } from "next/navigation"

export default function CreateCompetitionPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)

  // Step 1: General Data
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")

  // Para despues sacra la hora
  const [startDate, setStartDate] = useState("")
  const [startTime, setStartTime] = useState("")
  const [duration, setDuration] = useState(120) // minutes

  // Step 2: Scoring and Rules
  const [easyPoints, setEasyPoints] = useState(10)
  const [mediumPoints, setMediumPoints] = useState(30)
  const [hardPoints, setHardPoints] = useState(50)
  
  // const [tiebreaker, setTiebreaker] = useState("time")
  // const [hintsEnabled, setHintsEnabled] = useState(false)
  // const [hintPenalty, setHintPenalty] = useState("5")
  // const [wrongAttemptPenalty, setWrongAttemptPenalty] = useState(true)
  // const [penaltyMinutes, setPenaltyMinutes] = useState("5")

  // Step 3: Problems
  const [problems, setProblems] = useState<Problem[]>([])
  const [newProblemUrl, setNewProblemUrl] = useState("")
  const [newProblemTitle, setNewProblemTitle] = useState("")
  const [newProblemDifficulty, setNewProblemDifficulty] = useState<"easy" | "medium" | "hard">("easy")


  // Step 4: Teams
  // const [teamCodes, setTeamCodes] = useState<TeamCode[]>([])
  const [maxTeamSize, setMaxTeamSize] = useState(3)
  // const [numberOfTeams, setNumberOfTeams] = useState("20")

  const [rules, setRules] = useState<string[]>([])
  const [newRule, setNewRule] = useState("")

  const handleAddRule = () => {
    if (newRule.trim()) {
      setRules([...rules, newRule.trim()])
      setNewRule("")
    }
  }

  const handleRemoveRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index))
  }


  const steps = [
    { number: 1, title: "Datos Generales", description: "Información básica del evento" },
    { number: 2, title: "Puntajes y Reglas", description: "Sistema de puntuación y configuración" },
    { number: 3, title: "Problemas", description: "Selección de problemas de LeetCode" }
  ]

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(title && description && startDate && startTime)
      case 2:
        return !!(easyPoints && mediumPoints && hardPoints)
      case 3:
        return problems.length > 0 && problems.every((p) => p.isValid)
      default:
        return false
    }
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4))
    } else {
      toast("Por favor completa todos los campos requeridos")
    }
  }

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
  }

  const addProblem = () => {
    if (!newProblemUrl.trim() || !newProblemTitle.trim()) return

    const slug = newProblemUrl.split("/problems/")[1]?.replace("/", "") || "unknown"
    const newProblem: Problem = {
      id: crypto.randomUUID(),
      title: newProblemTitle.trim(),
      difficulty: newProblemDifficulty,
      url: newProblemUrl.trim(),
      slug,
      isValid: true,
      isValidating: false,
    }

    setProblems([...problems, newProblem])
    setNewProblemUrl("")
    setNewProblemTitle("")
    setNewProblemDifficulty("easy")
  }

  const removeProblem = (id: string) => {
    setProblems((prev) => prev.filter((p) => p.id !== id))
  }

  const publishCompetition = async () => {
    setIsLoading(true)

    const [year, month, day] = startDate.split("-").map(Number)
    const [hours, minutes] = startTime.split(":").map(Number)

    const competitionDate = new Date(year, month - 1, day, hours, minutes)

    // Simulate API call
    const competicion: Competition = {
      id: '',
      title: title,
      description: description,
      date: competitionDate,
      status: "active",
      duration: duration,
      teams: [],
      maxTeamSize: maxTeamSize,
      problems: problems,
      rules: rules,
      scoring: {
        easy: easyPoints,
        medium: mediumPoints,
        hard: hardPoints,
      }
    }

    try {
      await apiRequest('/competition/create', {
        method: 'POST',
        body: competicion
      })
    } catch (error) {
      console.error("Error al crear el equipo:", error)
      // Puedes mostrar un toast o alerta aquí si quieres
    } finally {
      setIsLoading(false)
      toast("La competencia está ahora disponible para los participantes")
      redirect("/")
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:border-green-800 dark:bg-green-950"
      case "medium":
        return "text-yellow-600 border-yellow-200 bg-yellow-50 dark:text-yellow-400 dark:border-yellow-800 dark:bg-yellow-950"
      case "hard":
        return "text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-800 dark:bg-red-950"
      default:
        return "text-muted-foreground"
    }
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Crear Nueva Competencia</h1>
            <p className="text-muted-foreground">Configura tu competencia de programación paso a paso</p>
          </div>

          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              {steps.map((step, index) => (
                <div key={step.number} className="flex items-center">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                      currentStep >= step.number
                        ? "bg-accent text-accent-foreground border-accent"
                        : "border-muted-foreground text-muted-foreground"
                    }`}
                  >
                    {currentStep > step.number ? <CheckCircle className="h-5 w-5" /> : <span>{step.number}</span>}
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`w-24 h-0.5 mx-4 ${currentStep > step.number ? "bg-accent" : "bg-muted-foreground"}`}
                    />
                  )}
                </div>
              ))}
            </div>
            <Progress value={(currentStep / steps.length) * 100} className="w-full" />
            <div className="mt-2 text-center">
              <h2 className="text-xl font-semibold">{steps[currentStep - 1].title}</h2>
              <p className="text-sm text-muted-foreground">{steps[currentStep - 1].description}</p>
            </div>
          </div>

          {/* Step Content */}
          <Card className="mb-8">
            <CardContent className="p-6">
              {/* Step 1: General Data */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="competition-name">
                        Nombre de la competencia *
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="inline h-4 w-4 ml-1 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Nombre descriptivo que verán los participantes</p>
                          </TooltipContent>
                        </Tooltip>
                      </Label>
                      <Input
                        id="competition-name"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Torneo Semanal - Algoritmos Básicos"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="duration">
                        Duración (minutos) *
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="inline h-4 w-4 ml-1 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Tiempo total de la competencia en minutos</p>
                          </TooltipContent>
                        </Tooltip>
                      </Label>
                      <Input
                        id="duration"
                        type="number"
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        placeholder="120"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descripción *</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe los objetivos y características de la competencia..."
                      className="min-h-[100px]"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-accent" />
                        Fecha y Hora de Inicio *
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="start-date">Fecha</Label>
                          <Input
                            id="start-date"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="start-time">Hora</Label>
                          <Input
                            id="start-time"
                            type="time"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Scoring and Rules */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-yellow-500" />
                      Sistema de Puntuación
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="easy-points">Problemas Fáciles *</Label>
                        <Input
                          id="easy-points"
                          type="number"
                          value={easyPoints}
                          onChange={(e) => setEasyPoints(Number(e.target.value))}
                          placeholder="10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="medium-points">Problemas Medios *</Label>
                        <Input
                          id="medium-points"
                          type="number"
                          value={mediumPoints}
                          onChange={(e) => setMediumPoints(Number(e.target.value))}
                          placeholder="30"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hard-points">Problemas Difíciles *</Label>
                        <Input
                          id="hard-points"
                          type="number"
                          value={hardPoints}
                          onChange={(e) => setHardPoints(Number(e.target.value))}
                          placeholder="50"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Settings className="h-5 w-5 text-accent" />
                      Configuración Avanzada
                    </h3>

                    {/* Reglas personalizadas */}
                    <div className="space-y-2 pt-4">
                      <Label htmlFor="rules">Reglas adicionales</Label>
                      <div className="flex gap-2">
                        <Input
                          id="rules"
                          type="text"
                          value={newRule}
                          onChange={(e) => setNewRule(e.target.value)}
                          placeholder="Escribe una regla..."
                          className="flex-1"
                        />
                        <Button onClick={handleAddRule}>Agregar</Button>
                      </div>

                      <ul className="list-disc pl-6 space-y-1">
                        {rules.map((rule, index) => (
                          <li key={index} className="flex justify-between items-center">
                            <span>{rule}</span>
                            <Button variant="outline" size="sm" onClick={() => handleRemoveRule(index)}>
                              Borrar
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>

                  </div>

                  <Separator />

                  <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Users className="h-5 w-5 text-accent" />
                        Configuración de Equipos
                      </h3>
                      
                      <div className="grid grid-cols-1 gap-4 mb-4">
                        <div className="space-y-2">
                          <Label htmlFor="max-team-size">Tamaño máximo de equipo</Label>
                          <Input
                            id="max-team-size"
                            type="number"
                            value={maxTeamSize}
                            onChange={(e) => setMaxTeamSize(Number(e.target.value))}
                            placeholder="4"
                          />
                        </div>
                      </div>
                    </div>
                </div>
              )}

              {
                currentStep === 3 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Target className="h-5 w-5 text-accent" />
                        Añadir Problemas de LeetCode
                      </h3>

                      <div className="space-y-2 mb-4">
                        <Input
                          value={newProblemUrl}
                          onChange={(e) => setNewProblemUrl(e.target.value)}
                          placeholder="https://leetcode.com/problems/two-sum/"
                        />
                        <Input
                          value={newProblemTitle}
                          onChange={(e) => setNewProblemTitle(e.target.value)}
                          placeholder="Título del problema"
                        />
                        <div className="flex gap-2 items-center">
                          <Label>Dificultad:</Label>
                          <Select
                            value={newProblemDifficulty}
                            onValueChange={(value) => setNewProblemDifficulty(value as "easy" | "medium" | "hard")}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="Selecciona dificultad" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="easy">Fácil</SelectItem>
                              <SelectItem value="medium">Medio</SelectItem>
                              <SelectItem value="hard">Difícil</SelectItem>
                            </SelectContent>
                          </Select>

                          <Button onClick={addProblem} disabled={!newProblemUrl.trim() || !newProblemTitle.trim()}>
                            <Plus className="mr-2 h-4 w-4" />
                            Añadir Problema
                          </Button>
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground mb-4">
                        Ingresa la URL, el título y la dificultad del problema. Se validará manualmente.
                      </p>
                    </div>

                    {problems.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3">Problemas Añadidos ({problems.length})</h4>
                        <ScrollArea className="h-64">
                          <div className="space-y-3">
                            {problems.map((problem) => (
                              <Card key={problem.id} className="p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    {problem.isValidating ? (
                                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent" />
                                    ) : problem.isValid ? (
                                      <CheckCircle className="h-5 w-5 text-green-500" />
                                    ) : (
                                      <AlertCircle className="h-5 w-5 text-red-500" />
                                    )}
                                    <div>
                                      <p className="font-medium">{problem.title}</p>
                                      <p className="text-sm text-muted-foreground">{problem.slug}</p>
                                    </div>
                                    <Badge className={`text-xs ${getDifficultyColor(problem.difficulty)}`}>
                                      {problem.difficulty === "easy"
                                        ? "Fácil"
                                        : problem.difficulty === "medium"
                                        ? "Medio"
                                        : "Difícil"}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => window.open(problem.url, "_blank")}
                                        >
                                          <ExternalLink className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Probar enlace</p>
                                      </TooltipContent>
                                    </Tooltip>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => removeProblem(problem.id || "")}
                                      className="text-red-500 hover:text-red-700"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                )
              }

              {/* Step 4: Teams */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Users className="h-5 w-5 text-accent" />
                      Configuración de Equipos
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <Label htmlFor="max-team-size">Tamaño máximo de equipo</Label>
                        <Input
                          id="max-team-size"
                          type="number"
                          value={maxTeamSize}
                          onChange={(e) => setMaxTeamSize(Number(e.target.value))}
                          placeholder="4"
                        />
                      </div>
                    </div>
                  </div>

                  
                </div>
              )}
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={prevStep} disabled={currentStep === 1} className="bg-transparent">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Anterior
            </Button>

            <div className="flex items-center gap-2">
              {currentStep < 3 ? (
                <Button
                  onClick={nextStep}
                  disabled={!validateStep(currentStep)}
                  className="bg-accent hover:bg-accent/90"
                >
                  Siguiente
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={publishCompetition}
                  disabled={!validateStep(currentStep) || isLoading}
                  className="bg-accent hover:bg-accent/90"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Publicando...
                    </>
                  ) : (
                    <>
                      <Award className="mr-2 h-4 w-4" />
                      Publicar Competencia
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
