"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Eye, EyeOff, Mail, Lock, User } from "lucide-react"
import { apiRequest } from "@/lib/api"
import { useAuth } from "@/hooks/useAuth"
import { useToken } from "@/hooks/useToken"
import { useTeamCode } from "@/hooks/useTeamCode"

interface LoginModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTab?: "login" | "register"
}

export function LoginModal({ open, onOpenChange, initialTab = "login" }: LoginModalProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<"login" | "register">(initialTab)
  const [loginError, setLoginError] = useState("")
  const [registerError, setRegisterError] = useState("")
  const {setIsAuthenticated, setCurrentUser} = useAuth()
  const {setToken} = useToken()
  const {setTeamCode} = useTeamCode()

  useEffect(() => {
    if (!open) {
      setActiveTab(initialTab)
      setLoginError("")
      setRegisterError("")
    }
  }, [open, initialTab])

  const handleTabChange = (value: string) => {
    setActiveTab(value as "login" | "register")
    setLoginError("")
    setRegisterError("")
  }

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError("");
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      username: formData.get("username"),
      password: formData.get("password"),
    };

    try {
      const response = await apiRequest('/auth/login', {
        method: 'POST',
        body: payload,
        useForm: true
      })
      setToken(response.access_token)
      localStorage.setItem('token', response.access_token)
      localStorage.setItem('auth', 'true')

      if (response.teamCode){
        localStorage.setItem('teamCode', response.teamCode)
        setTeamCode(response.teamCode)
      }
      // Fetch full user profile so currentUser is populated without a page reload
      try {
        const user = await apiRequest('/auth/verify', { method: 'GET', token: true })
        setCurrentUser(user)
      } catch { /* ignore — at worst currentUser stays null until refresh */ }
      setIsAuthenticated(true)
      onOpenChange(false)
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Error al iniciar sesión")
    } finally {
      setIsLoading(false);
    }
  };


  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setRegisterError("");
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      email: formData.get("email"),
      password: formData.get("password"),
      username: formData.get('username')
    };

    try {
      const response = await apiRequest('/users/register', {
        method: 'POST',
        body: payload
      })
      setToken(response.access_token)
      localStorage.setItem('token', response.access_token)
      localStorage.setItem('auth', 'true')
      // Fetch full user profile so currentUser is populated without a page reload
      try {
        const user = await apiRequest('/auth/verify', { method: 'GET', token: true })
        setCurrentUser(user)
      } catch { /* ignore */ }
      setIsAuthenticated(true)
      onOpenChange(false)
    } catch (error) {
      setRegisterError(error instanceof Error ? error.message : "Error al registrarse")
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bienvenido a CodeArena</DialogTitle>
          <DialogDescription>Inicia sesión o crea una cuenta para comenzar a competir</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
            <TabsTrigger value="register">Registrarse</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="space-y-4">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Nombre de usuario</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="username" name="username" type="text" placeholder="admin" className="pl-10" required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-10 pr-10"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
              {loginError && <p className="text-sm text-destructive">{loginError}</p>}
              <Button type="submit" className="w-full bg-accent hover:bg-accent/90" disabled={isLoading}>
                {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register" className="space-y-4">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Username (identificador único)</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="name" name="username" type="text" placeholder="ej. juan123" className="pl-10" required />
                </div>
                <p className="text-xs text-muted-foreground">Este será tu identificador único, no podrá cambiarse.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-email">Correo electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="register-email" name="email" type="email" placeholder="tu@email.com" className="pl-10" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-password">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="register-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-10 pr-10"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
              {registerError && <p className="text-sm text-destructive">{registerError}</p>}
              <Button type="submit" className="w-full bg-accent hover:bg-accent/90" disabled={isLoading}>
                {isLoading ? "Creando cuenta..." : "Crear Cuenta"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
