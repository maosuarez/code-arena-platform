"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Lock, Unlock, Flag, MapPin, ChevronRight, AlertTriangle, Footprints, Compass } from "lucide-react"
import { MazeState, MazeDoor, TeamMazeState } from "@/lib/types"

const TEAM_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
  "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
  "#BB8FCE", "#85C1E9",
]

function teamColor(teamCode: string, teams: TeamMazeState[]) {
  const idx = teams.findIndex(t => t.teamCode === teamCode)
  return TEAM_COLORS[idx % TEAM_COLORS.length] ?? "#888"
}

interface MazeViewProps {
  mazeState: MazeState | null
  myTeamCode: string
  onUnlockDoor: (doorId: string) => Promise<void>
  onMove: (doorId: string) => Promise<void>
  isUnlocking: boolean
  isMoving: boolean
}

export default function MazeView({ mazeState, myTeamCode, onUnlockDoor, onMove, isUnlocking, isMoving }: MazeViewProps) {
  const [selectedDoor, setSelectedDoor] = useState<string | null>(null)
  const [confirmDoorId, setConfirmDoorId] = useState<string | null>(null)

  if (!mazeState) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center">
          <MapPin className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>El laberinto aún no está configurado para esta competencia.</p>
        </div>
      </div>
    )
  }

  const { config, teams } = mazeState
  const myTeam = teams.find(t => t.teamCode === myTeamCode)
  const currentNodeId = myTeam?.currentNodeId ?? config.startNodeId
  const availablePoints = myTeam?.availablePoints ?? 0

  const myUnlockedDoors = myTeam?.unlockedDoors ?? []

  // Doors have no direction: either endpoint counts as "reachable from here".
  function touchesCurrentNode(door: MazeDoor) {
    return door.from_node === currentNodeId || door.to_node === currentNodeId
  }

  // The node you'd land on if you cross this door from where you stand now.
  function destinationNode(door: MazeDoor) {
    return door.from_node === currentNodeId ? door.to_node : door.from_node
  }

  // Nodos donde mi equipo ya estuvo: la salida, donde estoy, y los extremos de
  // cada puerta que abrí. Desde cualquiera de ellos puedo volver a abrir puertas.
  const visitedNodes = new Set<string>([config.startNodeId, currentNodeId])
  config.doors.forEach(d => {
    if (myUnlockedDoors.includes(d.id)) {
      visitedNodes.add(d.from_node)
      visitedNodes.add(d.to_node)
    }
  })

  function touchesVisited(door: MazeDoor) {
    return visitedNodes.has(door.from_node) || visitedNodes.has(door.to_node)
  }

  // Desde un nodo visitado, el otro extremo de la puerta.
  function otherEnd(door: MazeDoor) {
    return visitedNodes.has(door.from_node) ? door.to_node : door.from_node
  }
  function anchorNode(door: MazeDoor) {
    return visitedNodes.has(door.from_node) ? door.from_node : door.to_node
  }

  function nodeLabel(nodeId: string) {
    return config.nodes.find(n => n.id === nodeId)?.label ?? nodeId
  }

  // Puertas cerradas que puedo abrir parado donde estoy.
  const reachableDoors = config.doors.filter(
    d => touchesCurrentNode(d) && !myUnlockedDoors.includes(d.id)
  )

  // Puertas ya abiertas que tocan mi nodo: cruzarlas es gratis (ir y volver).
  const moveOptions = config.doors.filter(
    d => touchesCurrentNode(d) && myUnlockedDoors.includes(d.id)
  )

  // Puertas cerradas en nodos que ya visité pero donde no estoy parado: siguen a
  // la vista para no perder opciones, pero hay que volver a ese nodo para abrirlas.
  const pendingDoors = config.doors.filter(
    d => !myUnlockedDoors.includes(d.id) && !touchesCurrentNode(d) && touchesVisited(d)
  )

  // Determine door status from my team's perspective
  // "affordable"  = reachable from current node AND can pay the cost
  // "expensive"   = reachable from current node BUT can't pay yet
  // "pending"     = toca un nodo visitado, pero no el actual (hay que volver allí)
  // "locked"      = fuera de mi territorio explorado
  // "unlocked"    = already opened by my team
  function doorStatus(door: MazeDoor): "unlocked" | "affordable" | "expensive" | "pending" | "locked" {
    if (myUnlockedDoors.includes(door.id)) return "unlocked"
    if (!touchesCurrentNode(door)) return touchesVisited(door) ? "pending" : "locked"
    if (door.cost <= availablePoints) return "affordable"
    return "expensive"
  }

  function doorColor(door: MazeDoor) {
    const s = doorStatus(door)
    if (s === "unlocked") return "#22c55e"
    if (s === "affordable") return "#f59e0b"
    if (s === "expensive") return "#f97316"
    if (s === "pending") return "#8b5cf6"
    return "#6b7280"
  }

  // Find which teams have unlocked a given door
  function teamsOnDoor(doorId: string) {
    return teams.filter(t => t.unlockedDoors.includes(doorId))
  }

  // SVG dimensions (viewBox 0 0 100 100)
  const vb = "0 0 100 100"

  async function handleConfirmedUnlock(doorId: string) {
    setConfirmDoorId(null)
    await onUnlockDoor(doorId)
  }

  return (
    <div className="space-y-4">

      {config.fogOfWar && (
        <div className="flex items-center gap-2 text-xs rounded-lg border border-indigo-300 bg-indigo-500/10 text-indigo-700 px-3 py-2">
          <span>🌫️</span>
          <span>Modo niebla: ves todo tu territorio explorado y las puertas que salen de él, aunque ya no estés parado ahí. Puedes volver por puertas abiertas sin pagar de nuevo. El resto del laberinto (y la meta) permanece oculto hasta que lo explores.</span>
        </div>
      )}

      {/* Team legend + door status key */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          {teams.map(t => (
            <div key={t.teamCode} className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ background: teamColor(t.teamCode, teams) }} />
              <span className={t.teamCode === myTeamCode ? "font-bold" : "text-muted-foreground"}>
                {t.avatar} {t.teamName}
              </span>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5">{t.availablePoints} pts</Badge>
            </div>
          ))}
        </div>
        {/* Color legend for doors */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-4 h-0.5 inline-block bg-amber-500 rounded" />Asequible</span>
          <span className="flex items-center gap-1"><span className="w-4 h-0.5 inline-block bg-orange-500 rounded" />Caro</span>
          <span className="flex items-center gap-1"><span className="w-4 h-0.5 inline-block bg-green-500 rounded" />Abierto</span>
          <span className="flex items-center gap-1"><span className="w-4 h-0.5 inline-block rounded" style={{backgroundImage:"repeating-linear-gradient(90deg,#8b5cf6 0,#8b5cf6 4px,transparent 4px,transparent 7px)"}} />Pendiente</span>
          <span className="flex items-center gap-1"><span className="w-4 h-0.5 inline-block bg-gray-400 rounded border-dashed border border-gray-400" style={{backgroundImage:"repeating-linear-gradient(90deg,#9ca3af 0,#9ca3af 4px,transparent 4px,transparent 7px)"}}/> Bloqueado</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* SVG Maze */}
        <div className="lg:col-span-2">
          <div className="border rounded-xl bg-muted/20 p-2 overflow-hidden">
            <svg viewBox={vb} className="w-full" style={{ maxHeight: 480 }}>
              {/* Draw doors (edges) */}
              {config.doors.map(door => {
                const fromNode = config.nodes.find(n => n.id === door.from_node)
                const toNode = config.nodes.find(n => n.id === door.to_node)
                if (!fromNode || !toNode) return null
                const color = doorColor(door)
                const mx = (fromNode.x + toNode.x) / 2
                const my = (fromNode.y + toNode.y) / 2
                const isSelected = selectedDoor === door.id
                const status = doorStatus(door)
                const isAffordable = status === "affordable"
                return (
                  <g
                    key={door.id}
                    onClick={() => setSelectedDoor(isSelected ? null : door.id)}
                    style={{ cursor: "pointer" }}
                  >
                    {/* Glow for affordable doors */}
                    {isAffordable && (
                      <line
                        x1={fromNode.x} y1={fromNode.y}
                        x2={toNode.x} y2={toNode.y}
                        stroke={color}
                        strokeWidth={4}
                        opacity={0.15}
                      />
                    )}
                    <line
                      x1={fromNode.x} y1={fromNode.y}
                      x2={toNode.x} y2={toNode.y}
                      stroke={color}
                      strokeWidth={isSelected ? 2.2 : 1.4}
                      strokeDasharray={status === "locked" || status === "pending" ? "3 2" : undefined}
                      opacity={status === "locked" ? 0.4 : status === "pending" ? 0.75 : 0.9}
                    />
                    {/* Cost label */}
                    <rect x={mx - 5} y={my - 3.5} width={10} height={6} rx={1.5} fill="white" opacity={0.9} />
                    <text x={mx} y={my + 1.2} textAnchor="middle" fontSize={3.2} fill={color} fontWeight="bold">
                      {door.cost}
                    </text>
                    {/* Team dots on door */}
                    {teamsOnDoor(door.id).map((t, i) => (
                      <circle
                        key={t.teamCode}
                        cx={mx + (i - (teamsOnDoor(door.id).length - 1) / 2) * 3}
                        cy={my - 6}
                        r={1.5}
                        fill={teamColor(t.teamCode, teams)}
                        stroke="white"
                        strokeWidth={0.3}
                      />
                    ))}
                  </g>
                )
              })}

              {/* Draw nodes */}
              {config.nodes.map(node => {
                const isStart = node.id === config.startNodeId
                const isGoal = node.id === config.goalNodeId
                const isCurrent = node.id === currentNodeId
                const teamsHere = teams.filter(t => t.currentNodeId === node.id)

                return (
                  <g key={node.id}>
                    {/* Pulse ring for my current node */}
                    {isCurrent && (
                      <circle cx={node.x} cy={node.y} r={7} fill="none" stroke="#6366f1" strokeWidth={0.5} opacity={0.4} />
                    )}
                    <circle
                      cx={node.x} cy={node.y}
                      r={isCurrent ? 4.5 : 3.5}
                      fill={isGoal ? "#f59e0b" : isStart ? "#3b82f6" : visitedNodes.has(node.id) ? "#c7d2fe" : "white"}
                      stroke={isCurrent ? "#6366f1" : "#374151"}
                      strokeWidth={isCurrent ? 1.5 : 0.7}
                    />
                    <text x={node.x} y={node.y - 5.5} textAnchor="middle" fontSize={3} fill="#374151" fontWeight="500">
                      {node.label}
                    </text>
                    {isGoal && (
                      <text x={node.x} y={node.y + 1.5} textAnchor="middle" fontSize={3.5}>🏆</text>
                    )}
                    {isStart && !isGoal && (
                      <text x={node.x} y={node.y + 1.5} textAnchor="middle" fontSize={3}>🚀</text>
                    )}
                    {teamsHere.map((t, i) => (
                      <circle
                        key={t.teamCode}
                        cx={node.x + (i - (teamsHere.length - 1) / 2) * 4}
                        cy={node.y + 7.5}
                        r={2}
                        fill={teamColor(t.teamCode, teams)}
                        stroke="white"
                        strokeWidth={0.4}
                      >
                        <title>{t.teamName}</title>
                      </circle>
                    ))}
                  </g>
                )
              })}
            </svg>
          </div>
        </div>

        {/* Action panel */}
        <div className="space-y-3">

          {/* My team position summary */}
          {myTeam && (
            <Card className={currentNodeId === config.goalNodeId ? "border-yellow-400 bg-yellow-400/10" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-indigo-500" />
                  Mi posición
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {currentNodeId === config.goalNodeId ? (
                  <div className="text-center py-3">
                    <p className="text-lg font-bold text-yellow-600">Meta alcanzada</p>
                    <p className="text-xs text-muted-foreground mt-1">Tu equipo completó el laberinto</p>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Nodo actual</span>
                      <span className="font-semibold">
                        {config.nodes.find(n => n.id === currentNodeId)?.label ?? currentNodeId}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Puntos para gastar</span>
                      <span className="font-bold text-amber-600">{availablePoints}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Puertas abiertas</span>
                      <span className="font-semibold">{myTeam.unlockedDoors.length}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Reachable doors — the primary action area */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Unlock className="h-4 w-4 text-amber-500" />
                Puertas disponibles
                {reachableDoors.length > 0 && (
                  <Badge className="ml-auto bg-amber-500/20 text-amber-700 border-amber-400 text-[10px] py-0">
                    {reachableDoors.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {reachableDoors.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  {currentNodeId === config.goalNodeId
                    ? "Llegaste a la meta del laberinto"
                    : "No hay puertas accesibles desde aquí"}
                </p>
              ) : (
                reachableDoors.map(door => {
                  const toNode = config.nodes.find(n => n.id === destinationNode(door))
                  const canAfford = door.cost <= availablePoints
                  const remainingAfter = availablePoints - door.cost
                  const isConfirming = confirmDoorId === door.id

                  return (
                    <div
                      key={door.id}
                      className={`rounded-lg border p-3 transition-colors ${
                        isConfirming
                          ? "border-amber-400 bg-amber-500/10"
                          : canAfford
                          ? "border-amber-200 bg-amber-500/5 hover:bg-amber-500/10"
                          : "border-border bg-muted/30 opacity-60"
                      }`}
                    >
                      {/* Destination row */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          {toNode?.label ?? destinationNode(door)}
                          {door.label && (
                            <span className="text-xs text-muted-foreground font-normal">({door.label})</span>
                          )}
                        </div>
                        <Badge
                          className={`text-xs ${canAfford ? "bg-amber-500/20 text-amber-700 border-amber-400" : "bg-red-500/10 text-red-600 border-red-300"}`}
                        >
                          {door.cost} pts
                        </Badge>
                      </div>

                      {/* Cost preview */}
                      {canAfford && (
                        <p className="text-[11px] text-muted-foreground mb-2">
                          Quedarás con <span className="font-semibold text-foreground">{remainingAfter} pts</span> tras abrir
                        </p>
                      )}
                      {!canAfford && (
                        <p className="text-[11px] text-red-500 mb-2 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Faltan {door.cost - availablePoints} pts para abrir
                        </p>
                      )}

                      {/* Confirmation flow */}
                      {isConfirming ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1 h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                            disabled={isUnlocking}
                            onClick={() => handleConfirmedUnlock(door.id)}
                          >
                            {isUnlocking ? (
                              <span className="flex items-center gap-1.5">
                                <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                Abriendo...
                              </span>
                            ) : (
                              <><Unlock className="h-3 w-3 mr-1" />Confirmar</>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setConfirmDoorId(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full h-7 text-xs"
                          disabled={!canAfford || isUnlocking}
                          variant={canAfford ? "default" : "outline"}
                          onClick={() => canAfford && setConfirmDoorId(door.id)}
                        >
                          <Unlock className="h-3 w-3 mr-1" />
                          Abrir puerta
                        </Button>
                      )}
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          {/* Volver sobre tus pasos: cruzar puertas ya abiertas no cuesta nada */}
          {moveOptions.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Footprints className="h-4 w-4 text-green-600" />
                  Moverte (gratis)
                  <Badge className="ml-auto bg-green-500/20 text-green-700 border-green-400 text-[10px] py-0">
                    {moveOptions.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-[11px] text-muted-foreground">
                  Ya pagaste estas puertas: puedes cruzarlas las veces que quieras para volver
                  a un nodo anterior y abrir desde ahí las salidas que dejaste pendientes.
                </p>
                {moveOptions.map(door => (
                  <Button
                    key={door.id}
                    size="sm"
                    variant="outline"
                    className="w-full h-8 text-xs justify-start border-green-300 hover:bg-green-500/10"
                    disabled={isMoving || isUnlocking}
                    onClick={() => onMove(door.id)}
                  >
                    <Footprints className="h-3 w-3 mr-1.5 text-green-600 shrink-0" />
                    Ir a {nodeLabel(destinationNode(door))}
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Frontera explorada: puertas visibles que quedan en otros nodos visitados */}
          {pendingDoors.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Compass className="h-4 w-4 text-violet-500" />
                  Pendientes en tu ruta
                  <Badge className="ml-auto bg-violet-500/20 text-violet-700 border-violet-400 text-[10px] py-0">
                    {pendingDoors.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground">
                  Salidas que viste en nodos por los que ya pasaste. Vuelve a ese nodo para abrirlas.
                </p>
                {pendingDoors.map(door => (
                  <div
                    key={door.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-violet-200 bg-violet-500/5 px-2.5 py-1.5 text-xs"
                  >
                    <span className="flex items-center gap-1 min-w-0">
                      <span className="font-semibold shrink-0">{nodeLabel(anchorNode(door))}</span>
                      <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{nodeLabel(otherEnd(door))}</span>
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] py-0 shrink-0 ${door.cost <= availablePoints ? "border-violet-400 text-violet-700" : "border-red-300 text-red-600"}`}
                    >
                      {door.cost} pts
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* All teams positions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Flag className="h-4 w-4 text-blue-500" />
                Equipos en el laberinto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-40">
                <div className="space-y-1.5">
                  {[...teams]
                    .sort((a, b) => b.unlockedDoors.length - a.unlockedDoors.length)
                    .map((t, rank) => {
                      const node = t.currentNodeId ? config.nodes.find(n => n.id === t.currentNodeId) : null
                      const isMe = t.teamCode === myTeamCode
                      return (
                        <div
                          key={t.teamCode}
                          className={`flex items-center justify-between text-xs rounded px-1.5 py-1 ${isMe ? "bg-accent/10 font-semibold" : ""}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-4 text-right">{rank + 1}.</span>
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: teamColor(t.teamCode, teams) }} />
                            <span>{t.avatar} {t.teamName}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span>{node?.label ?? (t.currentNodeId ?? "❔ Desconocida")}</span>
                            <span className="flex items-center gap-0.5">
                              <Lock className="h-2.5 w-2.5" />{t.unlockedDoors.length}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
