"use client"

import { useAccount, useConnect, useDisconnect } from "wagmi"
import { SOMNIA_CHAIN_ID, SOMNIA_CHAIN_NAME } from "@/lib/somnia-config"
import { Button } from "@/components/ui/button"
import { useWalletBalance } from "@/hooks/use-wallet-balance"
import { formatEther } from "@/lib/format-utils"

export function WalletButton() {
  const { address, isConnected, chainId } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { balance, loading } = useWalletBalance()

  const isOnSomnia = chainId === SOMNIA_CHAIN_ID

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-foreground">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
          <span className="text-xs text-accent font-semibold bg-accent/10 px-2 py-1 rounded">
          {loading ? "..." : `${formatEther(balance)} STT`}
        </span>
        <Button onClick={() => disconnect()} variant="default" size="sm" className="bg-accent text-accent-foreground">
          Disconnect
        </Button>
        {!isOnSomnia && (
          <div className="text-xs text-destructive font-semibold ml-2">
            Wrong network! Please switch to {SOMNIA_CHAIN_NAME} (Chain ID: {SOMNIA_CHAIN_ID}) in your wallet.
          </div>
        )}
      </div>
    )
  }

  return (
    <Button
      onClick={() => {
        const injectedConnector = connectors.find((c) => c.id === "injected")
        if (injectedConnector) {
          connect({ connector: injectedConnector })
        }
      }}
      size="sm"
  variant="default"
      className="bg-accent text-accent-foreground"
    >
      Connect Wallet
    </Button>
  )
}
