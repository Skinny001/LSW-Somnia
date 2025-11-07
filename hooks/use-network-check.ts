import { useAccount } from "wagmi"
import { SOMNIA_CHAIN_ID, SOMNIA_CHAIN_NAME } from "@/lib/somnia-config"

export function useNetworkCheck() {
  const { chainId } = useAccount()
  const isOnSomnia = chainId === SOMNIA_CHAIN_ID

  return {
    isOnSomnia,
    currentChainId: chainId,
    somniaName: SOMNIA_CHAIN_NAME,
    somniaId: SOMNIA_CHAIN_ID,
  }
}
