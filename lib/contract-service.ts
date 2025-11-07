"use client"

import { createPublicClient, http, decodeEventLog } from "viem"
import type { Log } from "viem"
import { somniaTestnet } from "./wagmi-config"
import { LSW_CONTRACT_ADDRESS, USE_MOCK_SERVICE } from "./somnia-config"
import { LSW_ABI } from "./contract-abi"

// Public client used for read-only calls and log polling
const publicClient = createPublicClient({
  transport: http(somniaTestnet.rpcUrls.default.http[0]),
  chain: somniaTestnet,
})

export interface RoundInfo {
  roundId: bigint
  lastStaker: string
  totalAmount: bigint
  deadline: bigint
  isActive: boolean
  stakersCount: bigint
  stakingAvailableAt: bigint
}

async function readContractView(functionName: string) {
  // generic read helper
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - viem PublicClient readContract signature
  const res = await publicClient.readContract({
    address: LSW_CONTRACT_ADDRESS as `0x${string}`,
    abi: LSW_ABI as any,
    functionName,
  })
  return res as any
}

export async function getCurrentRoundInfo(): Promise<RoundInfo> {
  const res = await readContractView("getCurrentRoundInfo")
  // viem can return an array-like or object depending on ABI; normalize
  const r: any = res
  const currentRoundId = Array.isArray(r) ? r[0] : r.currentRoundId
  const lastStaker = Array.isArray(r) ? r[1] : r.lastStaker
  const totalAmount = Array.isArray(r) ? r[2] : r.totalAmount
  const deadline = Array.isArray(r) ? r[3] : r.deadline
  const isActive = Array.isArray(r) ? r[4] : r.isActive
  const stakersCount = Array.isArray(r) ? r[5] : r.stakersCount
  const stakingAvailableAt = Array.isArray(r) ? r[6] : r.stakingAvailableAt

  return {
    roundId: BigInt(currentRoundId ?? BigInt(0)),
    lastStaker: String(lastStaker ?? "0x0000000000000000000000000000000000000000"),
    totalAmount: BigInt(totalAmount ?? BigInt(0)),
    deadline: BigInt(deadline ?? BigInt(0)),
    isActive: Boolean(isActive ?? false),
    stakersCount: BigInt(stakersCount ?? BigInt(0)),
    stakingAvailableAt: BigInt(stakingAvailableAt ?? BigInt(0)),
  }
}

export async function getTimeRemaining(): Promise<bigint> {
  const res: any = await readContractView("getTimeRemaining")
  return BigInt(res ?? BigInt(0))
}

export async function getTimeUntilStakingAvailable(): Promise<bigint> {
  const res: any = await readContractView("getTimeUntilStakingAvailable")
  return BigInt(res ?? BigInt(0))
}

export async function isStakingAvailable(): Promise<boolean> {
  const res: any = await readContractView("isStakingAvailable")
  return Boolean(res)
}

export async function getStakeAmount(): Promise<bigint> {
  const res: any = await readContractView("stakeAmount")
  return BigInt(res ?? BigInt(0))
}

// Writes (stake / startNewRound) should be executed by a signer (wagmi write hooks).
// Keep these stubs to signal that writes are handled elsewhere.
export async function stake(_account: `0x${string}`): Promise<string> {
  throw new Error("Use wagmi write hooks (useContractWrite) to perform staking transactions from the connected wallet")
}

export async function startNewRound(_account: `0x${string}`): Promise<string> {
  throw new Error("Use wagmi write hooks (useContractWrite) to start a new round from the connected wallet")
}

// Event watchers implemented with a simple log polling approach.
// Each watcher returns an unsubscribe function that stops the polling.
function createLogPoller(eventName: string, handler: (log: Log) => void, pollInterval = 5000) {
  let mounted = true
  let lastBlock = BigInt(0)

  const poll = async () => {
    try {
      const blockNumber = BigInt(await publicClient.getBlockNumber())
      if (lastBlock === BigInt(0)) {
        // start from a recent block window to avoid loading huge history
        lastBlock = blockNumber > BigInt(100) ? blockNumber - BigInt(100) : BigInt(0)
      }

      if (blockNumber <= lastBlock) return

      const logs = await publicClient.getLogs({
        address: LSW_CONTRACT_ADDRESS as `0x${string}`,
        fromBlock: lastBlock + BigInt(1),
        toBlock: blockNumber,
      })

      for (const log of logs) {
        handler(log)
      }

      lastBlock = blockNumber
    } catch (err) {
      // keep polling even if an error happens
      // console.error("log poller error:", err)
    }
  }

  // start polling
  const id = setInterval(() => {
    if (!mounted) return
    void poll()
  }, pollInterval)

  // run an immediate poll
  void poll()

  return () => {
    mounted = false
    clearInterval(id)
  }
}

export async function watchStakeEvents(
  onStake: (roundId: bigint, staker: string, amount: bigint, newDeadline: bigint) => void,
) {
  const unsubscribe = createLogPoller("StakeReceived", (log) => {
    try {
      const parsed: any = decodeEventLog({ abi: LSW_ABI as any, data: log.data, topics: log.topics })
      const args = parsed.args || {}
      // Debug log to inspect args and parsed
      console.log("StakeReceived event decoded:", { args, parsed })
      const roundId = BigInt(args[0] ?? args.roundId ?? parsed.roundId ?? BigInt(0))
      const staker = String(
        args.staker ?? args[1] ?? parsed.staker ?? "0x0000000000000000000000000000000000000000"
      )
      console.log("Extracted staker:", staker)
      const amount = BigInt(args.amount ?? args[2] ?? parsed.amount ?? BigInt(0))
      const newDeadline = BigInt(args.newDeadline ?? args[3] ?? parsed.newDeadline ?? BigInt(0))

      onStake(roundId, staker, amount, newDeadline)
    } catch (err) {
      console.error("Error decoding StakeReceived event:", err)
    }
  })

  return unsubscribe
}

export async function watchRoundStartedEvents(
  onRoundStarted: (roundId: bigint, deadline: bigint, stakingStartTime: bigint) => void,
) {
  const unsubscribe = createLogPoller("RoundStarted", (log) => {
    try {
  const parsed: any = decodeEventLog({ abi: LSW_ABI as any, data: log.data, topics: log.topics })
  const roundId = BigInt(parsed.args?.[0] ?? parsed.roundId ?? BigInt(0))
  const deadline = BigInt(parsed.args?.[1] ?? parsed.deadline ?? BigInt(0))
  const stakingStartTime = BigInt(parsed.args?.[2] ?? parsed._stakingStartTime ?? BigInt(0))

      onRoundStarted(roundId, deadline, stakingStartTime)
    } catch (err) {
      // ignore
    }
  })

  return unsubscribe
}

export async function watchRoundEndedEvents(
  onRoundEnded: (roundId: bigint, winner: string, totalAmount: bigint) => void,
) {
  const unsubscribe = createLogPoller("RoundEnded", (log) => {
    try {
      const parsed: any = decodeEventLog({ abi: LSW_ABI as any, data: log.data, topics: log.topics })
      const args = parsed.args || {}
      // Debug log to inspect args and parsed
      console.log("RoundEnded event decoded:", { args, parsed })
      const roundId = BigInt(args[0] ?? args.roundId ?? parsed.roundId ?? BigInt(0))
      const winner = String(
        args.winner ?? args[1] ?? parsed.winner ?? "0x0000000000000000000000000000000000000000"
      )
      console.log("Extracted winner:", winner)
      const totalAmount = BigInt(args.totalAmount ?? args[2] ?? parsed.totalAmount ?? BigInt(0))

      onRoundEnded(roundId, winner, totalAmount)
    } catch (err) {
      console.error("Error decoding RoundEnded event:", err)
    }
  })

  return unsubscribe
}

// Fetch recent RoundEnded events for history. Respects USE_MOCK_SERVICE toggle.
export async function fetchRecentRounds(limit = 10) {
  if (USE_MOCK_SERVICE) {
    // Provide the same mock data shape used by the component before
    return [
      {
        roundId: BigInt(5),
        winner: "0x1234...5678",
        totalAmount: BigInt("500000000000000000"),
        stakersCount: 12,
        timestamp: Date.now() - 3600000,
      },
      {
        roundId: BigInt(4),
        winner: "0x9abc...def0",
        totalAmount: BigInt("350000000000000000"),
        stakersCount: 8,
        timestamp: Date.now() - 7200000,
      },
    ]
  }

  // query recent logs for RoundEnded and RewardsDistributed events from a recent block window
  try {
    const currentBlock = BigInt(await publicClient.getBlockNumber())
    const fromBlock = currentBlock > BigInt(1000) ? currentBlock - BigInt(1000) : BigInt(0)
    const logs = await publicClient.getLogs({
      address: LSW_CONTRACT_ADDRESS as `0x${string}`,
      fromBlock,
      toBlock: currentBlock,
    })

    // Parse events for each round
    const rounds: Record<string, any> = {}
    for (const log of logs) {
      try {
        const parsed: any = decodeEventLog({ abi: LSW_ABI as any, data: log.data, topics: log.topics })
        if (parsed?.name === "RoundEnded" || parsed?.eventName === "RoundEnded") {
          const roundId = BigInt(parsed.args?.[0] ?? parsed.roundId ?? BigInt(0))
          const winner = String(parsed.args?.[1] ?? parsed.winner ?? "0x0000000000000000000000000000000000000000")
          const totalAmount = BigInt(parsed.args?.[2] ?? parsed.totalAmount ?? BigInt(0))
          rounds[roundId.toString()] = { roundId, winner, totalAmount, timestamp: Date.now() }
        }
        if (parsed?.name === "RewardsDistributed" || parsed?.eventName === "RewardsDistributed") {
          const roundId = BigInt(parsed.args?.[0] ?? parsed.roundId ?? BigInt(0))
          const randomWinners = parsed.args?.winners ?? []
          const rewardPerWinner = BigInt(parsed.args?.rewardPerWinner ?? BigInt(0))
          const treasuryAmount = BigInt(parsed.args?.treasuryAmount ?? BigInt(0))
          if (rounds[roundId.toString()]) {
            rounds[roundId.toString()].rewards = {
              randomWinners,
              rewardPerWinner,
              treasuryAmount,
            }
          } else {
            rounds[roundId.toString()] = {
              roundId,
              rewards: {
                randomWinners,
                rewardPerWinner,
                treasuryAmount,
              },
              timestamp: Date.now(),
            }
          }
        }
      } catch (err) {
        // skip
      }
    }

    // pick the most recent `limit` rounds
    const sorted = Object.values(rounds).sort((a, b) => Number(b.roundId) - Number(a.roundId))
    return sorted.slice(0, limit)
  } catch (err) {
    return []
  }
}

