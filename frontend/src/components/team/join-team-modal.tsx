"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { UserPlus, Hash } from "lucide-react"
import { apiRequest } from "@/lib/api"
import { useTeamCode } from "@/hooks/useTeamCode"

interface JoinTeamModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function JoinTeamModal({ open, onOpenChange }: JoinTeamModalProps) {
  const [inputCode, setInputCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { setTeamCode } = useTeamCode()

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputCode.trim()) return

    setIsLoading(true)
    try {
      const response = await apiRequest('/teams/join', {
        method: 'POST',
        body: {
          teamCode: inputCode.replace("-", "")
        },
        token: true
      })
      setTeamCode(response.teamCode)
      localStorage.setItem('teamCode', response.teamCode)
      setInputCode("")
      onOpenChange(false)
    } catch (error) {
      console.error("Error al unirse al equipo:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatTeamCode = (value: string): string => {
    const cleaned = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
    const trimmed = cleaned.slice(0, 6)
    return trimmed.length > 3
      ? `${trimmed.slice(0, 3)}-${trimmed.slice(3)}`
      : trimmed
  }

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatTeamCode(e.target.value)
    if (formatted.length <= 7) {
      setInputCode(formatted)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-secondary" />
            Unirse a Equipo
          </DialogTitle>
          <DialogDescription>Ingresa el código de invitación que te compartió tu equipo</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleJoinTeam} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="team-code" className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Código del equipo
            </Label>
            <Input
              id="team-code"
              value={inputCode}
              onChange={handleCodeChange}
              placeholder="ABC-DEF"
              className="text-center text-lg font-mono tracking-wider"
              required
            />
            <p className="text-xs text-muted-foreground text-center">
              El código debe tener 6 caracteres (formato: XXX-XXX)
            </p>
          </div>

          {/* Example */}
          <div className="p-4 rounded-lg bg-muted/50 border">
            <p className="text-sm text-muted-foreground mb-2">Ejemplo de código:</p>
            <code className="text-sm font-mono bg-background px-2 py-1 rounded border">FIR-202</code>
          </div>

          <Button
            type="submit"
            className="w-full bg-transparent"
            variant="outline"
            disabled={isLoading || inputCode.length < 7}
          >
            {isLoading ? "Uniéndose..." : "Unirse al Equipo"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
