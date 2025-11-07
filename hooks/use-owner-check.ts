"use client"

import { useState, useEffect } from "react"
import { useAccount, useReadContract } from "wagmi"
import { LSW_CONTRACT_ADDRESS } from "@/lib/somnia-config"
import { LSW_ABI } from "@/lib/contract-abi"

export function useOwnerCheck() {
  const { address, isConnected } = useAccount()
  const [isOwner, setIsOwner] = useState(false)
  const [loading, setLoading] = useState(true)

  const { data: ownerAddress } = useReadContract({
    address: LSW_CONTRACT_ADDRESS as `0x${string}`,
    abi: LSW_ABI,
    functionName: "owner",
  })

  useEffect(() => {
    if (isConnected && address && ownerAddress) {
      // Read a comma-separated list of dev admin addresses from env (inlined at build time).
      // Example: NEXT_PUBLIC_DEV_ADMIN_ADDRESSES="0xabc...,0xdef..."
      const devAddressesStr = process.env.NEXT_PUBLIC_DEV_ADMIN_ADDRESSES ?? ""
      const devAddresses = devAddressesStr
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)

      const connected = address.toLowerCase()
      const owner = (ownerAddress as string).toLowerCase()

      // Owner if connected matches on-chain owner OR is included in the dev admin list.
      setIsOwner(connected === owner || devAddresses.includes(connected))
    } else {
      setIsOwner(false)
    }
    setLoading(false)
  }, [address, isConnected, ownerAddress])

  return { isOwner, loading, ownerAddress: ownerAddress as string | undefined, address, isConnected }
}
