"use client"

import { useState } from "react"
import { Navbar } from "./navbar"
import { LoginModal } from "./auth/login-modal"

export function NavbarWrapper() {
  const [loginModalOpen, setLoginModalOpen] = useState(false)

  return (
    <>
      <Navbar onLoginClick={() => setLoginModalOpen(true)} />
      <LoginModal open={loginModalOpen} onOpenChange={setLoginModalOpen} />
    </>
  )
}
