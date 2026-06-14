"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Trophy, Clock, Users, Target, AlertCircle } from "lucide-react"
import { Competition } from "@/lib/types"

interface CompetitionDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  competition: Competition | undefined
}

export function CompetitionDetailsModal({ open, onOpenChange, competition }: CompetitionDetailsModalProps) {
  if(!competition){return null}
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            {competition.title}
          </DialogTitle>
          <DialogDescription>{competition.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status and Basic Info */}
          <div className="flex flex-wrap gap-3">
            <Badge
              className={
                competition.status === "active"
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  : competition.status === "upcoming"
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                    : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
              }
            >
              {competition.status === "active"
                ? "Activa"
                : competition.status === "upcoming"
                  ? "Próxima"
                  : "Finalizada"}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {competition.duration}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {competition.teams} equipos
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Target className="h-3 w-3" />
              {competition.problems.length} problemas
            </Badge>
          </div>

          <Separator />

          {/* Scoring System */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Sistema de Puntuación
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">Fácil</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">{competition.scoring.easy} pts</p>
              </div>
              <div className="p-3 rounded-lg border bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Medio</p>
                <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                  {competition.scoring.medium} pts
                </p>
              </div>
              <div className="p-3 rounded-lg border bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
                <p className="text-sm font-medium text-red-800 dark:text-red-200">Difícil</p>
                <p className="text-lg font-bold text-red-600 dark:text-red-400">{competition.scoring.hard} pts</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Rules */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Reglas y Condiciones
            </h3>
            <ul className="space-y-2">
              {competition.rules.map((rule, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-accent font-bold mt-0.5">•</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button className="flex-1 bg-accent hover:bg-accent/90">Unirme con mi Equipo</Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
