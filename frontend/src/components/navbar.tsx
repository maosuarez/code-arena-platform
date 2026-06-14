"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Moon, Sun, Code2, Menu, X, Sparkles } from "lucide-react"
import { useTheme } from "next-themes"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

import { useAuth } from "@/hooks/useAuth"
import { useToken } from "@/hooks/useToken"
import { useTeamCode } from "@/hooks/useTeamCode"

interface NavbarProps {
  onLoginClick?: () => void
}

export function Navbar({ onLoginClick }: NavbarProps) {
  const { setTheme } = useTheme()
  const { isAuthenticated, setIsAuthenticated } = useAuth()
  const { setToken } = useToken()
  const { setTeamCode } = useTeamCode()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const logout = () => {
                    localStorage.removeItem("token") // 🔥 Eliminar token
                    setToken('')
                    localStorage.removeItem('auth')
                    setIsAuthenticated(false)
                    localStorage.removeItem('teamCode')
                    setTeamCode('')
                    window.location.reload()         // 🔄 Refrescar para reiniciar estado
                  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2 group cursor-pointer">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
              <Code2 className="h-6 w-6 text-white group-hover:rotate-12 transition-transform duration-300" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xl font-bold bg-gradient-to-r from-slate-900 to-blue-900 dark:from-slate-100 dark:to-blue-100 bg-clip-text text-transparent group-hover:from-blue-600 group-hover:to-purple-600 transition-all duration-300">
                CodeArena
              </span>
              <Sparkles className="h-4 w-4 text-blue-500 opacity-0 group-hover:opacity-100 group-hover:animate-pulse transition-all duration-300" />
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4">
            {/* Theme Toggle */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 px-0 rounded-xl hover:bg-accent/20 hover:scale-110 transition-all duration-300 shadow-sm hover:shadow-md"
                >
                  <Sun className="h-5 w-5 rotate-0 scale-100 transition-all duration-500 dark:-rotate-90 dark:scale-0 text-amber-500" />
                  <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all duration-500 dark:rotate-0 dark:scale-100 text-blue-400" />
                  <span className="sr-only">Cambiar tema</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="animate-in slide-in-from-top-2 shadow-xl border-0 bg-background/95 backdrop-blur-xl"
              >
                <DropdownMenuItem
                  onClick={() => setTheme("light")}
                  className="hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors cursor-pointer"
                >
                  <Sun className="h-4 w-4 mr-2 text-amber-500" />
                  Modo claro
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme("dark")}
                  className="hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors cursor-pointer"
                >
                  <Moon className="h-4 w-4 mr-2 text-blue-400" />
                  Modo oscuro
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme("system")}
                  className="hover:bg-slate-50 dark:hover:bg-slate-950/20 transition-colors cursor-pointer"
                >
                  <Code2 className="h-4 w-4 mr-2 text-slate-500" />
                  Sistema
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Auth Buttons */}
            {
              !isAuthenticated ? (
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onLoginClick}
                    className="hover:bg-slate-100 dark:hover:bg-slate-800 hover:scale-105 transition-all duration-300 rounded-xl px-4"
                  >
                    Iniciar sesión
                  </Button>
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 rounded-xl px-4"
                    onClick={onLoginClick}
                  >
                    Registrarse
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="hover:bg-red-100 dark:hover:bg-red-800 hover:scale-105 transition-all duration-300 rounded-xl px-4 text-red-600 border-red-600"
                  onClick={logout}
                >
                  Cerrar sesión
                </Button>
              )
            }

          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              className="h-10 w-10 px-0 rounded-xl hover:bg-accent/20 hover:scale-110 transition-all duration-300"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <div className="relative">
                <Menu
                  className={`h-5 w-5 transition-all duration-300 ${mobileMenuOpen ? "rotate-90 scale-0" : "rotate-0 scale-100"}`}
                />
                <X
                  className={`absolute inset-0 h-5 w-5 transition-all duration-300 ${mobileMenuOpen ? "rotate-0 scale-100" : "-rotate-90 scale-0"}`}
                />
              </div>
              <span className="sr-only">Abrir menú</span>
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            mobileMenuOpen ? "max-h-64 opacity-100 border-t border-border/40" : "max-h-0 opacity-0"
          }`}
        >
          <div className="py-4 space-y-3 animate-in slide-in-from-top-2">
            {/* Auth Buttons */}

            {/* Auth Buttons (Mobile) */}
            {
              !isAuthenticated ? (
                <div>
                  <Button
                    variant="ghost"
                    className="w-full justify-start hover:bg-slate-100 dark:hover:bg-slate-800 hover:scale-[1.02] transition-all duration-300 rounded-xl"
                    onClick={onLoginClick}
                  >
                    Iniciar sesión
                  </Button>
                  <Button
                    className="w-full justify-start bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 rounded-xl"
                    onClick={onLoginClick}
                  >
                    Registrarse
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full justify-start text-red-600 hover:bg-red-100 dark:hover:bg-red-800 hover:scale-[1.02] transition-all duration-300 rounded-xl"
                  onClick={logout}
                >
                  Cerrar sesión
                </Button>
              )
            }

            <div className="flex items-center justify-between pt-3 border-t border-border/40">
              <span className="text-sm text-muted-foreground font-medium">Tema</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 px-0 rounded-xl hover:bg-accent/20 hover:scale-110 transition-all duration-300"
                  >
                    <Sun className="h-4 w-4 rotate-0 scale-100 transition-all duration-500 dark:-rotate-90 dark:scale-0 text-amber-500" />
                    <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all duration-500 dark:rotate-0 dark:scale-100 text-blue-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="animate-in slide-in-from-top-2 shadow-xl border-0 bg-background/95 backdrop-blur-xl"
                >
                  <DropdownMenuItem
                    onClick={() => setTheme("light")}
                    className="hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors cursor-pointer"
                  >
                    <Sun className="h-4 w-4 mr-2 text-amber-500" />
                    Modo claro
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setTheme("dark")}
                    className="hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors cursor-pointer"
                  >
                    <Moon className="h-4 w-4 mr-2 text-blue-400" />
                    Modo oscuro
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setTheme("system")}
                    className="hover:bg-slate-50 dark:hover:bg-slate-950/20 transition-colors cursor-pointer"
                  >
                    <Code2 className="h-4 w-4 mr-2 text-slate-500" />
                    Sistema
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
