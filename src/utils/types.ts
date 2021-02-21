export type ChainId = 1 | 42 | 56 | 97

export type Addresses = {
  [chainId in number]: string
}

export enum ErrorCodes {
  TOKEN_NAME,
  TOKEN_SYMBOL,
  TOKEN_DECIMALS,
}

export interface TokenError extends Error {
  code?: ErrorCodes
}

export type Pool = {
  address: string
  aTokenAddress: string
  aTokenSymbol: string
  aTokenDecimals: number
  bTokenAddress: string
  bTokenSymbol: string
  bTokenDecimals: number
  getATokenCash: (...args: any[]) => Promise<any>
  getBTokenCash: (...args: any[]) => Promise<any>
}

export type Pools = {
  [chainId in ChainId]: {
    [address: string]: Pool
  }
}
