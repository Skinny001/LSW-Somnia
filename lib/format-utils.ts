// Utility functions to replace viem formatEther
export function formatEther(value: bigint | string | number): string {
  // Ensure value is BigInt
  let bigIntValue: bigint
  try {
    if (typeof value === 'bigint') {
      bigIntValue = value
    } else if (typeof value === 'string' || typeof value === 'number') {
      bigIntValue = BigInt(value)
    } else {
      bigIntValue = BigInt(0)
    }
  } catch (error) {
    console.warn('formatEther: Invalid value, defaulting to 0:', value, error)
    bigIntValue = BigInt(0)
  }

  const decimals = 18
  let divisor = BigInt(1)
  for (let i = 0; i < decimals; i++) {
    divisor *= BigInt(10)
  }
  const whole = bigIntValue / divisor
  const remainder = bigIntValue % divisor

  if (remainder === BigInt(0)) {
    return whole.toString()
  }

  const remainderStr = remainder.toString().padStart(decimals, "0").replace(/0+$/, "")
  return `${whole}.${remainderStr}`
}

// Parse a decimal string (e.g. "0.01") into wei (bigint). Returns null for invalid input.
export function parseEther(input: string): bigint | null {
  if (typeof input !== "string") return null
  const s = input.trim()
  if (s.length === 0) return null
  const match = s.match(/^([0-9]+)(?:\.([0-9]+))?$/)
  if (!match) return null
  const whole = match[1]
  const fraction = match[2] ?? ""
  const decimals = 18
  if (fraction.length > decimals) {
    // too many decimals
    return null
  }
  const wholeBig = BigInt(whole)
  let fracStr = fraction.padEnd(decimals, "0")
  const fracBig = BigInt(fracStr)
  let divisor = BigInt(1)
  for (let i = 0; i < decimals; i++) divisor *= BigInt(10)
  return wholeBig * divisor + fracBig
}

export function formatAddress(address: string): string {
  if (!address) return ""
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

//hbar uses 8 decimals
// the issue here is contract retunr bigint in string format
export function formatHbar(value: bigint | string | number): string {
  // Use 18 decimals for Somnia STT token display (keeps function name for
  // compatibility with the rest of the codebase).
  
  // Ensure value is BigInt
  let bigIntValue: bigint
  try {
    if (typeof value === 'bigint') {
      bigIntValue = value
    } else if (typeof value === 'string' || typeof value === 'number') {
      bigIntValue = BigInt(value)
    } else {
      bigIntValue = BigInt(0)
    }
  } catch (error) {
    console.warn('formatHbar: Invalid value, defaulting to 0:', value, error)
    bigIntValue = BigInt(0)
  }
  
  const decimals = 18
  let divisor = BigInt(1)
  for (let i = 0; i < decimals; i++) {
    divisor *= BigInt(10)
  }
  const whole = bigIntValue / divisor
  const remainder = bigIntValue % divisor

  if (remainder === BigInt(0)) {
    return whole.toString()
  }

  const remainderStr = remainder.toString().padStart(decimals, "0").replace(/0+$/, "")
  return `${whole}.${remainderStr}`
}



export function hbarToTinybar(amount: string | number): bigint {
  // Convert STT (decimal) to smallest unit (wei-like, 10^18)
  return BigInt(Math.floor(Number(amount) * 1e18));
}

