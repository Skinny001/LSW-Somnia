import { publishRoundEndedEventServer } from "@/lib/somnia-streams-server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { roundId, winner, totalAmount, timestamp } = body

    // Validate inputs
    if (!roundId || !winner || !totalAmount) {
      return NextResponse.json(
        { error: "Missing required fields: roundId, winner, totalAmount" },
        { status: 400 }
      )
    }

    // Validate addresses
    if (!winner.startsWith("0x") || winner.length !== 42) {
      return NextResponse.json(
        { error: "Invalid winner address" },
        { status: 400 }
      )
    }



    // Publish to Somnia Streams (server-side function)
    const txHash = await publishRoundEndedEventServer(
      roundId,
      winner as `0x${string}`,
      totalAmount,
      timestamp || Math.floor(Date.now() / 1000)
    )

    if (!txHash) {
      return NextResponse.json(
        { error: "Failed to publish event to Somnia Streams" },
        { status: 500 }
      )
    }



    return NextResponse.json(
      {
        success: true,
        txHash,
        roundId,
        winner,
        totalAmount,
        timestamp
      },
      { status: 200 }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("❌ API Error:", errorMessage)

    return NextResponse.json(
      { error: `Failed to publish event: ${errorMessage}` },
      { status: 500 }
    )
  }
}
