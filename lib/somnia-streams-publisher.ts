// lib/somnia-streams-publisher.ts
// Publishes RoundEnded events to Somnia Data Streams

import { SDK, SchemaEncoder, zeroBytes32 } from '@somnia-chain/streams'
import { createPublicClient, createWalletClient, http, toHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { waitForTransactionReceipt } from 'viem'
import { somniaTestnet } from './wagmi-config'

let sdkInstance: SDK | null = null

const ROUND_ENDED_SCHEMA = 'uint256 roundId, address winner, uint256 totalAmount, uint256 timestamp'

async function initializeSDK() {
  if (sdkInstance) return sdkInstance

  const privateKey = process.env.NEXT_PUBLIC_PUBLISHER_PRIVATE_KEY as `0x${string}`
  const publisherAddress = process.env.NEXT_PUBLIC_PUBLISHER_ADDRESS as `0x${string}`

  if (!privateKey || !publisherAddress) {
    console.warn('⚠️ NEXT_PUBLIC_PUBLISHER_PRIVATE_KEY or NEXT_PUBLIC_PUBLISHER_ADDRESS not set')
    return null
  }

  try {
    const account = privateKeyToAccount(privateKey)
    
    const publicClient = createPublicClient({
      chain: somniaTestnet,
      transport: http(somniaTestnet.rpcUrls.default.http[0])
    })

    const walletClient = createWalletClient({
      account,
      chain: somniaTestnet,
      transport: http(somniaTestnet.rpcUrls.default.http[0])
    })

    sdkInstance = new SDK({
      public: publicClient,
      wallet: walletClient
    })


    return sdkInstance
  } catch (err) {
    console.error('❌ Failed to initialize SDK:', err)
    return null
  }
}

export async function registerRoundEndedSchema() {
  const sdk = await initializeSDK()
  if (!sdk) return null

  try {
    const schemaId = await sdk.streams.computeSchemaId(ROUND_ENDED_SCHEMA)

    // Register schema
    const txHash = await sdk.streams.registerDataSchemas(
      [
        {
          schemaName: 'round_ended',
          schema: ROUND_ENDED_SCHEMA,
          parentSchemaId: zeroBytes32
        }
      ],
      true // ignoreRegisteredSchemas
    )

    if (txHash) {
      const publicClient = createPublicClient({
        chain: somniaTestnet,
        transport: http(somniaTestnet.rpcUrls.default.http[0])
      })
      await waitForTransactionReceipt(publicClient, { hash: txHash })
    }

    return schemaId
  } catch (err) {
    console.error('❌ Failed to register schema:', err)
    return null
  }
}

export async function publishRoundEnded(
  roundId: bigint,
  winner: string,
  totalAmount: bigint,
  timestamp: number
) {
  const sdk = await initializeSDK()
  if (!sdk) {
    console.warn('⚠️ SDK not initialized, cannot publish')
    return null
  }

  try {

    const schemaId = await sdk.streams.computeSchemaId(ROUND_ENDED_SCHEMA)
    const encoder = new SchemaEncoder(ROUND_ENDED_SCHEMA)

    const data = encoder.encodeData([
      { name: 'roundId', value: roundId, type: 'uint256' },
      { name: 'winner', value: winner, type: 'address' },
      { name: 'totalAmount', value: totalAmount, type: 'uint256' },
      { name: 'timestamp', value: BigInt(Math.floor(timestamp / 1000)), type: 'uint256' }
    ])

    const dataStreams = [
      {
        id: toHex(`round-ended-${roundId}`, { size: 32 }),
        schemaId,
        data
      }
    ]

    const txHash = await sdk.streams.set(dataStreams)

    return txHash
  } catch (err) {
    console.error('❌ Failed to publish RoundEnded event:', err)
    return null
  }
}

export async function emitRoundEndedEvent(
  roundId: bigint,
  winner: string,
  totalAmount: bigint
) {
  const sdk = await initializeSDK()
  if (!sdk) {
    console.warn('⚠️ SDK not initialized, cannot emit event')
    return null
  }

  try {

    // Emit event for real-time subscribers
    const txHash = await sdk.streams.emitEvents([
      {
        id: 'RoundEnded',
        argumentTopics: [toHex(roundId.toString())],
        data: toHex(`${winner}${totalAmount.toString().slice(2)}`, { size: 32 })
      }
    ])
  } catch (err) {
    console.error('❌ Failed to emit RoundEnded event:', err)
    return null
  }
}
