"use client"

import { useState } from "react"
import { Navbar } from "./navbar"
import { LoginModal } from "./auth/login-modal"
import { useWsHealth } from "@/hooks/useWsHealth"

export function NavbarWrapper() {
  useWsHealth()

  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const [loginTab, setLoginTab] = useState<"login" | "register">("login")

  const handleLoginClick = () => {
    setLoginTab("login")
    setLoginModalOpen(true)
  }

  const handleRegisterClick = () => {
    setLoginTab("register")
    setLoginModalOpen(true)
  }

  return (
    <>
      <Navbar onLoginClick={handleLoginClick} onRegisterClick={handleRegisterClick} />
      <LoginModal open={loginModalOpen} onOpenChange={setLoginModalOpen} initialTab={loginTab} />
    </>
  )
}
