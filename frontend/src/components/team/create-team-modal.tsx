"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Users, Palette, User } from "lucide-react"
import { apiRequest } from "@/lib/api"
import { useTeamCode } from "@/hooks/useTeamCode"

interface CreateTeamModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const teamColors = [
  { name: "Azul", value: "blue", class: "bg-blue-500" },
  { name: "Verde", value: "green", class: "bg-green-500" },
  { name: "Rojo", value: "red", class: "bg-red-500" },
  { name: "Púrpura", value: "purple", class: "bg-purple-500" },
  { name: "Naranja", value: "orange", class: "bg-orange-500" },
  { name: "Rosa", value: "pink", class: "bg-pink-500" },
]

const teamAvatars = ["🚀", "⚡", "🔥", "💎", "🎯", "🏆", "⭐", "🎮"]

export function CreateTeamModal({ open, onOpenChange }: CreateTeamModalProps) {
  const [teamName, setTeamName] = useState("")
  const [selectedColor, setSelectedColor] = useState("blue")
  const [selectedAvatar, setSelectedAvatar] = useState("🚀")
  const [isLoading, setIsLoading] = useState(false)

  const {setTeamCode} = useTeamCode()

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!teamName.trim()) return

    setIsLoading(true)

    try {
      const response = await apiRequest('/teams/create', {
        method: 'POST',
        body: {
          maxMembers: 3,
          avatar: selectedAvatar,
          color: selectedColor,
          teamName: teamName, // ✅ corregido
        },
        token: true
      })

      // Puedes manejar la respuesta aquí si lo necesitas
      setTeamCode(response.team.code)
      localStorage.setItem('teamCode', response.team.code)
      window.location.reload()
    } catch (error) {
      console.error("Error al crear el equipo:", error)
      // Puedes mostrar un toast o alerta aquí si quieres
    } finally {
      setIsLoading(false)
      onOpenChange(false)
    }

    // Reset form
    setTeamName("")
    setSelectedColor("blue")
    setSelectedAvatar("🚀")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-accent" />
            Crear Nuevo Equipo
          </DialogTitle>
          <DialogDescription>Personaliza tu equipo con un nombre único, color y avatar</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreateTeam} className="space-y-6">
          {/* Team Name */}
          <div className="space-y-2">
            <Label htmlFor="team-name">Nombre del equipo</Label>
            <Input
              id="team-name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Los Algoritmos Supremos"
              maxLength={30}
              required
            />
            <p className="text-xs text-muted-foreground">{teamName.length}/30 caracteres</p>
          </div>

          {/* Color Selection */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Color del equipo
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {teamColors.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setSelectedColor(color.value)}
                  className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all ${
                    selectedColor === color.value
                      ? "border-accent bg-accent/10"
                      : "border-border hover:border-accent/50"
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full ${color.class}`} />
                  <span className="text-sm">{color.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Avatar Selection */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Avatar del equipo
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {teamAvatars.map((avatar) => (
                <button
                  key={avatar}
                  type="button"
                  onClick={() => setSelectedAvatar(avatar)}
                  className={`p-3 text-2xl rounded-lg border-2 transition-all hover:scale-105 ${
                    selectedAvatar === avatar ? "border-accent bg-accent/10" : "border-border hover:border-accent/50"
                  }`}
                >
                  {avatar}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 rounded-lg bg-muted/50 border">
            <p className="text-sm text-muted-foreground mb-2">Vista previa:</p>
            <div className="flex items-center gap-3">
              <div className="text-2xl">{selectedAvatar}</div>
              <div>
                <p className="font-semibold">{teamName || "Nombre del equipo"}</p>
                <Badge
                  variant="outline"
                  className={`${teamColors.find((c) => c.value === selectedColor)?.class} text-white border-transparent`}
                >
                  {teamColors.find((c) => c.value === selectedColor)?.name}
                </Badge>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-accent hover:bg-accent/90"
            disabled={isLoading || !teamName.trim()}
          >
            {isLoading ? "Creando equipo..." : "Crear Equipo"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
