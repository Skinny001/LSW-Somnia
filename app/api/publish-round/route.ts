import { publishRoundEndedEventServer } from '@/lib/somnia-streams-server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { roundId, winner, totalAmount } = body

    if (!roundId || !winner || !totalAmount) {
      return NextResponse.json(
        { error: 'Missing required fields: roundId, winner, totalAmount' },
        { status: 400 }
      )
    }

    const txHash = await publishRoundEndedEventServer(roundId, winner, totalAmount)
    console.log('✅ Published RoundEnded event, txHash:', txHash)
    
    return NextResponse.json({
      success: true,
      txHash,
      message: `Published round ${roundId} to Streams`
    })
  } catch (err) {
    return NextResponse.json(
      { 
        error: err instanceof Error ? err.message : 'Failed to publish round',
        success: false
      },
      { status: 500 }
    )
  }
}
