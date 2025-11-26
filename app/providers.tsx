"use client"

import type React from "react"
import { WagmiProvider } from "wagmi"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { wagmiConfig } from "@/lib/wagmi-config"
import { useInitializeStreams } from "@/hooks/use-initialize-streams"

const queryClient = new QueryClient()

function StreamsInitializer({ children }: { children: React.ReactNode }) {
  // Initialize Somnia Streams and cache schema ID on app load
  useInitializeStreams()
  return <>{children}</>
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <StreamsInitializer>{children}</StreamsInitializer>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
