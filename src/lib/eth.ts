import Decimal from 'decimal.js'
import type { EthAmount } from '@/api/contracts'

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP })

export const ETH_DECIMALS = 18

export function eth(value: EthAmount | number): Decimal {
  return new D(value)
}

export function toEthString(value: Decimal): EthAmount {
  return value.toDecimalPlaces(ETH_DECIMALS).toFixed()
}

export function add(...values: EthAmount[]): EthAmount {
  return toEthString(values.reduce((acc, v) => acc.plus(v), new D(0)))
}

export function sub(a: EthAmount, b: EthAmount): EthAmount {
  return toEthString(new D(a).minus(b))
}

export function mul(a: EthAmount, quantity: number): EthAmount {
  if (!Number.isInteger(quantity)) throw new Error('Quantity must be an integer')
  return toEthString(new D(a).times(quantity))
}

export function percentOf(amount: EthAmount, percent: number): EthAmount {
  return toEthString(new D(amount).times(percent).dividedBy(100).toDecimalPlaces(6, Decimal.ROUND_DOWN))
}

export function compare(a: EthAmount, b: EthAmount): number {
  return new D(a).comparedTo(b)
}

export function isValidEth(value: string): boolean {
  if (!/^\d+(\.\d+)?$/.test(value.trim())) return false
  return true
}

export function formatEth(value: EthAmount, { unit = true }: { unit?: boolean } = {}): string {
  const d = new D(value)
  const dp = Math.min(Math.max(d.decimalPlaces(), 2), 6)
  const text = d.toFixed(dp)
  return unit ? `${text} ETH` : text
}
