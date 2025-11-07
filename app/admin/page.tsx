"use client"

import { useState, useEffect } from "react"
import { AdminPanel } from "@/components/admin-panel"
import { useOwnerCheck } from "@/hooks/use-owner-check"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function AdminPage() {
  const { isOwner, loading, isConnected } = useOwnerCheck()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-2 sm:px-4 py-3 flex items-center justify-between">
            <Link href="/">
              <div className="flex flex-row items-center gap-2 cursor-pointer">
                <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ease-out">
                  <span className="text-accent-foreground font-bold">LSW</span>
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-foreground">Last Staker Wins</h1>
                  <p className="text-xs text-muted-foreground">Admin Panel</p>
                </div>
              </div>
            </Link>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-8 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        </div>
      </main>
    )
  }

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-2 sm:px-4 py-3 flex items-center justify-between">
            <Link href="/">
              <div className="flex flex-row items-center gap-2 cursor-pointer">
                <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ease-out">
                  <span className="text-accent-foreground font-bold">LSW</span>
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-foreground">Last Staker Wins</h1>
                  <p className="text-xs text-muted-foreground">Admin Panel</p>
                </div>
              </div>
            </Link>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-8 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="text-destructive">Please connect your wallet to access the admin panel.</div>
            <Link href="/">
              <Button variant="outline">Back to Game</Button>
            </Link>
          </div>
        </div>
      </main>
    )
  }

  if (!isOwner) {
    return (
      <main className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-2 sm:px-4 py-3 flex items-center justify-between">
            <Link href="/">
              <div className="flex flex-row items-center gap-2 cursor-pointer">
                <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ease-out">
                  <span className="text-accent-foreground font-bold">LSW</span>
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-foreground">Last Staker Wins</h1>
                  <p className="text-xs text-muted-foreground">Admin Panel</p>
                </div>
              </div>
            </Link>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-8 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="text-destructive">Access Denied: Only the contract owner can access this page.</div>
            <Link href="/">
              <Button variant="outline">Back to Game</Button>
            </Link>
          </div>
        </div>
      </main>
    )
  }

  // Owner is connected and authorized
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-3 flex items-center justify-between">
          <Link href="/">
            <div className="flex flex-row items-center gap-2 cursor-pointer">
              <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ease-out">
                <span className="text-accent-foreground font-bold">LSW</span>
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-foreground">Last Staker Wins</h1>
                <p className="text-xs text-muted-foreground">Admin Panel</p>
              </div>
            </div>
          </Link>
          <Link href="/">
            <Button variant="outline" size="sm">Back to Game</Button>
          </Link>
        </div>
      </header>
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-8">
        <AdminPanel />
      </div>
    </main>
  )
}
