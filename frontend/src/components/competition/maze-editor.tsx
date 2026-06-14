"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { apiRequest } from "@/lib/api"
import { MazeNode, MazeDoor } from "@/lib/types"
import {
  MousePointer2,
  GitBranch,
  Move,
  Trash2,
  Save,
  Flag,
  Trophy,
  RotateCcw,
} from "lucide-react"

type Mode = "node" | "door" | "move" | "delete"

interface MazeEditorProps {
  competitionId: string
  onSaved?: () => void
}

export default function MazeEditor({ competitionId, onSaved }: MazeEditorProps) {
  const [nodes, setNodes] = useState<MazeNode[]>([])
  const [doors, setDoors] = useState<MazeDoor[]>([])
  const [startNodeId, setStartNodeId] = useState<string | null>(null)
  const [goalNodeId, setGoalNodeId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>("node")
  const [selected, setSelected] = useState<{ type: "node" | "door"; id: string } | null>(null)
  const [doorFirstNode, setDoorFirstNode] = useState<string | null>(null)
  const [pendingDoor, setPendingDoor] = useState<{ from: string; to: string } | null>(null)
  const [pendingCost, setPendingCost] = useState("10")
  const [dragging, setDragging] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)

  // Load existing maze from backend on mount so edits persist across sessions
  useEffect(() => {
    async function loadMaze() {
      try {
        const res = await apiRequest(`/maze/${competitionId}/state`, { method: "GET" })
        const config = res?.config
        if (config) {
          if (Array.isArray(config.nodes)) setNodes(config.nodes)
          if (Array.isArray(config.doors)) setDoors(config.doors)
          if (config.startNodeId) setStartNodeId(config.startNodeId)
          if (config.goalNodeId) setGoalNodeId(config.goalNodeId)
        }
      } catch {
        // No maze configured yet — start with blank canvas
      }
    }
    loadMaze()
  }, [competitionId])

  const getSvgCoords = useCallback((e: React.MouseEvent) => {
    const rect = svgRef.current!.getBoundingClientRect()
    return {
      x: Math.round(Math.max(4, Math.min(96, ((e.clientX - rect.left) / rect.width) * 100))),
      y: Math.round(Math.max(4, Math.min(96, ((e.clientY - rect.top) / rect.height) * 100))),
    }
  }, [])

  const nextLabel = () => {
    const used = new Set(nodes.map(n => n.label))
    for (let i = 0; i < 26; i++) {
      const l = String.fromCharCode(65 + i)
      if (!used.has(l)) return l
    }
    return `N${nodes.length}`
  }

  const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.target !== svgRef.current) return // click on child element, not the bg
    if (mode !== "node") return
    const { x, y } = getSvgCoords(e)
    const id = crypto.randomUUID()
    const node: MazeNode = { id, label: nextLabel(), x, y }
    setNodes(prev => [...prev, node])
    setSelected({ type: "node", id })
  }, [mode, getSvgCoords, nodes])

  const handleNodeClick = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    if (mode === "delete") {
      setNodes(prev => prev.filter(n => n.id !== nodeId))
      setDoors(prev => prev.filter(d => d.from_node !== nodeId && d.to_node !== nodeId))
      if (startNodeId === nodeId) setStartNodeId(null)
      if (goalNodeId === nodeId) setGoalNodeId(null)
      if (selected?.id === nodeId) setSelected(null)
      return
    }
    if (mode === "door") {
      if (!doorFirstNode) {
        setDoorFirstNode(nodeId)
        return
      }
      if (doorFirstNode === nodeId) {
        setDoorFirstNode(null)
        return
      }
      // Check duplicate
      const exists = doors.some(
        d => (d.from_node === doorFirstNode && d.to_node === nodeId) ||
             (d.from_node === nodeId && d.to_node === doorFirstNode)
      )
      if (exists) {
        toast.error("Ya existe una puerta entre esos nodos")
        setDoorFirstNode(null)
        return
      }
      setPendingDoor({ from: doorFirstNode, to: nodeId })
      setPendingCost("10")
      setDoorFirstNode(null)
      return
    }
    setSelected({ type: "node", id: nodeId })
  }, [mode, doorFirstNode, doors, startNodeId, goalNodeId, selected])

  const handleDoorClick = useCallback((e: React.MouseEvent, doorId: string) => {
    e.stopPropagation()
    if (mode === "delete") {
      setDoors(prev => prev.filter(d => d.id !== doorId))
      if (selected?.id === doorId) setSelected(null)
      return
    }
    setSelected({ type: "door", id: doorId })
  }, [mode, selected])

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    if (mode !== "move") return
    e.stopPropagation()
    e.preventDefault()
    setDragging(nodeId)
  }, [mode])

  const handleSvgMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return
    const { x, y } = getSvgCoords(e)
    setNodes(prev => prev.map(n => n.id === dragging ? { ...n, x, y } : n))
  }, [dragging, getSvgCoords])

  const handleSvgMouseUp = useCallback(() => setDragging(null), [])

  const confirmPendingDoor = () => {
    if (!pendingDoor) return
    const cost = parseInt(pendingCost) || 10
    const door: MazeDoor = {
      id: crypto.randomUUID(),
      from_node: pendingDoor.from,
      to_node: pendingDoor.to,
      cost,
      label: "",
    }
    setDoors(prev => [...prev, door])
    setSelected({ type: "door", id: door.id })
    setPendingDoor(null)
  }

  const updateSelectedNode = (field: keyof MazeNode, value: string | number) => {
    if (!selected || selected.type !== "node") return
    setNodes(prev => prev.map(n => n.id === selected.id ? { ...n, [field]: value } : n))
  }

  const updateSelectedDoor = (field: keyof MazeDoor, value: string | number) => {
    if (!selected || selected.type !== "door") return
    setDoors(prev => prev.map(d => d.id === selected.id ? { ...d, [field]: value } : d))
  }

  const selectedNode = selected?.type === "node" ? nodes.find(n => n.id === selected.id) : null
  const selectedDoor = selected?.type === "door" ? doors.find(d => d.id === selected.id) : null

  const handleSave = async () => {
    if (nodes.length < 2) { toast.error("Necesitas al menos 2 nodos"); return }
    if (!startNodeId) { toast.error("Define un nodo de inicio (click en nodo → Start)"); return }
    if (!goalNodeId) { toast.error("Define un nodo meta (click en nodo → Meta)"); return }
    if (doors.length === 0) { toast.error("Agrega al menos una puerta"); return }

    setIsSaving(true)
    try {
      await apiRequest(`/maze/${competitionId}`, {
        method: "POST",
        token: true,
        body: { nodes, doors, startNodeId, goalNodeId, competitionId },
      })
      toast.success("Laberinto guardado")
      onSaved?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar")
    } finally {
      setIsSaving(false)
    }
  }

  const nodeLabel = (id: string) => nodes.find(n => n.id === id)?.label ?? id.slice(0, 4)

  const modeButtons: { m: Mode; icon: React.ReactNode; label: string; color: string }[] = [
    { m: "node", icon: <MousePointer2 className="h-4 w-4" />, label: "Añadir Nodo", color: "default" },
    { m: "door", icon: <GitBranch className="h-4 w-4" />, label: "Añadir Puerta", color: "default" },
    { m: "move", icon: <Move className="h-4 w-4" />, label: "Mover", color: "default" },
    { m: "delete", icon: <Trash2 className="h-4 w-4" />, label: "Eliminar", color: "default" },
  ]

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {modeButtons.map(({ m, icon, label }) => (
          <Button
            key={m}
            size="sm"
            variant={mode === m ? "default" : "outline"}
            onClick={() => { setMode(m); setDoorFirstNode(null); setSelected(null) }}
            className={mode === m ? "bg-accent text-accent-foreground" : ""}
          >
            {icon}
            <span className="ml-1.5 hidden sm:inline">{label}</span>
          </Button>
        ))}
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setNodes([]); setDoors([]); setStartNodeId(null); setGoalNodeId(null); setSelected(null) }}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button size="sm" className="bg-accent hover:bg-accent/90" onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-1.5" />
            {isSaving ? "Guardando..." : "Guardar Laberinto"}
          </Button>
        </div>
      </div>

      {/* Mode hint */}
      <p className="text-xs text-muted-foreground">
        {mode === "node" && "Haz clic en el canvas para añadir un nodo."}
        {mode === "door" && (!doorFirstNode ? "Haz clic en el nodo de origen." : `Origen: ${nodeLabel(doorFirstNode)} — ahora haz clic en el nodo destino.`)}
        {mode === "move" && "Arrastra los nodos para reposicionarlos."}
        {mode === "delete" && "Haz clic en un nodo o puerta para eliminarlo."}
      </p>

      {/* SVG Canvas */}
      <div className="border-2 border-dashed border-muted rounded-xl bg-muted/10 overflow-hidden" style={{ height: 420 }}>
        <svg
          ref={svgRef}
          viewBox="0 0 100 100"
          className="w-full h-full"
          style={{ cursor: mode === "node" ? "crosshair" : mode === "move" ? "grab" : "default" }}
          onClick={handleSvgClick}
          onMouseMove={handleSvgMouseMove}
          onMouseUp={handleSvgMouseUp}
          onMouseLeave={handleSvgMouseUp}
        >
          {/* Doors */}
          {doors.map(door => {
            const from = nodes.find(n => n.id === door.from_node)
            const to = nodes.find(n => n.id === door.to_node)
            if (!from || !to) return null
            const mx = (from.x + to.x) / 2
            const my = (from.y + to.y) / 2
            const isSelected = selected?.id === door.id
            return (
              <g key={door.id} onClick={e => handleDoorClick(e, door.id)} style={{ cursor: "pointer" }}>
                {/* Hit area */}
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="transparent" strokeWidth={4} />
                {/* Visible line */}
                <line
                  x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                  stroke={isSelected ? "#6366f1" : "#94a3b8"}
                  strokeWidth={isSelected ? 1.5 : 1}
                  markerEnd="url(#arrow)"
                />
                {/* Cost badge */}
                <rect x={mx - 5} y={my - 3.5} width={10} height={7} rx={2}
                  fill={isSelected ? "#6366f1" : "white"}
                  stroke={isSelected ? "#6366f1" : "#94a3b8"}
                  strokeWidth={0.5}
                />
                <text x={mx} y={my + 2} textAnchor="middle" fontSize={4}
                  fill={isSelected ? "white" : "#475569"} fontWeight="600">
                  {door.cost}
                </text>
              </g>
            )
          })}

          {/* Arrow marker */}
          <defs>
            <marker id="arrow" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto">
              <path d="M0,0 L4,2 L0,4 Z" fill="#94a3b8" />
            </marker>
          </defs>

          {/* Ghost line while picking door target */}
          {doorFirstNode && (() => {
            const from = nodes.find(n => n.id === doorFirstNode)
            if (!from) return null
            return (
              <circle cx={from.x} cy={from.y} r={5} fill="none" stroke="#f59e0b" strokeWidth={1} strokeDasharray="2 1" />
            )
          })()}

          {/* Nodes */}
          {nodes.map(node => {
            const isStart = node.id === startNodeId
            const isGoal = node.id === goalNodeId
            const isDoorFrom = node.id === doorFirstNode
            const isSelected = selected?.id === node.id
            const r = 4.5

            return (
              <g
                key={node.id}
                onClick={e => handleNodeClick(e, node.id)}
                onMouseDown={e => handleNodeMouseDown(e, node.id)}
                style={{ cursor: mode === "move" ? "grab" : "pointer" }}
              >
                {/* Selection ring */}
                {(isSelected || isDoorFrom) && (
                  <circle cx={node.x} cy={node.y} r={r + 2.5}
                    fill="none" stroke={isDoorFrom ? "#f59e0b" : "#6366f1"} strokeWidth={1} strokeDasharray="2 1" />
                )}
                {/* Node circle */}
                <circle
                  cx={node.x} cy={node.y} r={r}
                  fill={isGoal ? "#f59e0b" : isStart ? "#22c55e" : "white"}
                  stroke={isSelected ? "#6366f1" : isGoal ? "#d97706" : isStart ? "#16a34a" : "#64748b"}
                  strokeWidth={1}
                />
                {/* Label */}
                <text x={node.x} y={node.y + 1.5} textAnchor="middle" fontSize={4}
                  fill={isGoal || isStart ? "white" : "#1e293b"} fontWeight="700">
                  {node.label}
                </text>
                {/* Start/Goal icon below */}
                <text x={node.x} y={node.y + r + 4} textAnchor="middle" fontSize={3.5}>
                  {isStart ? "🚀" : isGoal ? "🏆" : ""}
                </text>
              </g>
            )
          })}

          {nodes.length === 0 && (
            <text x="50" y="50" textAnchor="middle" fontSize="5" fill="#94a3b8">
              Haz clic para añadir nodos
            </text>
          )}
        </svg>
      </div>

      {/* Pending door cost dialog */}
      {pendingDoor && (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-amber-50 dark:bg-amber-950 border-amber-200">
          <GitBranch className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Puerta {nodeLabel(pendingDoor.from)} → {nodeLabel(pendingDoor.to)} — Costo:
          </span>
          <Input
            type="number"
            min={1}
            value={pendingCost}
            onChange={e => setPendingCost(e.target.value)}
            className="w-20 h-7 text-sm"
            autoFocus
            onKeyDown={e => e.key === "Enter" && confirmPendingDoor()}
          />
          <Button size="sm" onClick={confirmPendingDoor} className="bg-amber-600 hover:bg-amber-700 h-7">
            Confirmar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPendingDoor(null)} className="h-7">
            Cancelar
          </Button>
        </div>
      )}

      {/* Inspector panel */}
      {selectedNode && (
        <div className="flex flex-wrap items-end gap-4 p-3 rounded-lg border bg-muted/20">
          <div className="space-y-1">
            <Label className="text-xs">Etiqueta</Label>
            <Input
              value={selectedNode.label}
              onChange={e => updateSelectedNode("label", e.target.value)}
              className="h-7 w-20 text-sm font-mono"
              maxLength={4}
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={startNodeId === selectedNode.id ? "default" : "outline"}
              className={startNodeId === selectedNode.id ? "bg-green-600 hover:bg-green-700 h-7" : "h-7"}
              onClick={() => setStartNodeId(prev => prev === selectedNode.id ? null : selectedNode.id)}
            >
              <Flag className="h-3 w-3 mr-1" />
              {startNodeId === selectedNode.id ? "✓ Inicio" : "Marcar Inicio"}
            </Button>
            <Button
              size="sm"
              variant={goalNodeId === selectedNode.id ? "default" : "outline"}
              className={goalNodeId === selectedNode.id ? "bg-yellow-500 hover:bg-yellow-600 h-7" : "h-7"}
              onClick={() => setGoalNodeId(prev => prev === selectedNode.id ? null : selectedNode.id)}
            >
              <Trophy className="h-3 w-3 mr-1" />
              {goalNodeId === selectedNode.id ? "✓ Meta" : "Marcar Meta"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-red-500 hover:text-red-700"
              onClick={() => handleNodeClick({ stopPropagation: () => {} } as React.MouseEvent, selectedNode.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Pos: ({selectedNode.x}, {selectedNode.y})
          </div>
        </div>
      )}

      {selectedDoor && (
        <div className="flex flex-wrap items-end gap-4 p-3 rounded-lg border bg-muted/20">
          <div className="text-sm font-medium">
            Puerta: {nodeLabel(selectedDoor.from_node)} → {nodeLabel(selectedDoor.to_node)}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Costo (pts)</Label>
            <Input
              type="number"
              min={1}
              value={selectedDoor.cost}
              onChange={e => updateSelectedDoor("cost", parseInt(e.target.value) || 1)}
              className="h-7 w-20 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Descripción (opcional)</Label>
            <Input
              value={selectedDoor.label}
              onChange={e => updateSelectedDoor("label", e.target.value)}
              className="h-7 w-40 text-sm"
              placeholder="Ej: Camino rápido"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-red-500 hover:text-red-700"
            onClick={() => {
              setDoors(prev => prev.filter(d => d.id !== selectedDoor.id))
              setSelected(null)
            }}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Eliminar
          </Button>
        </div>
      )}

      {/* Summary */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span>{nodes.length} nodos</span>
        <span>{doors.length} puertas</span>
        {startNodeId && <Badge variant="outline" className="text-xs py-0 text-green-600">🚀 Inicio: {nodeLabel(startNodeId)}</Badge>}
        {goalNodeId && <Badge variant="outline" className="text-xs py-0 text-yellow-600">🏆 Meta: {nodeLabel(goalNodeId)}</Badge>}
      </div>
    </div>
  )
}
