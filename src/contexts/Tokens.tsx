import React, {
  createContext,
  useContext,
  useReducer,
  useMemo,
  useCallback,
  useEffect,
} from 'react'

import { useWeb3React } from '../hooks/ethereum'
import {
  safeAccess,
  isAddress,
  getTokenName,
  getTokenSymbol,
  getTokenDecimals,
} from '../utils'

import { ChainId } from '../utils/types'

type TokensContext = any[]

type TokensState = {}

const NAME = 'name'
const SYMBOL = 'symbol'
const DECIMALS = 'decimals'

const UPDATE = 'UPDATE'

const INITIAL_TOKENS_CONTEXT = {
  1: {
    '0x6B175474E89094C44Da98b954EedeAC495271d0F': {
      [NAME]: 'Dai Stablecoin',
      [SYMBOL]: 'DAI',
      [DECIMALS]: 18,
    },
    '0x57Ab1ec28D129707052df4dF418D58a2D46d5f51': {
      [NAME]: 'Synth sUSD',
      [SYMBOL]: 'sUSD',
      [DECIMALS]: 18,
    },
  },
  42: {
    '0x8F69BD7078681f889f6D8bad4227B3B0A3F2d9B0': {
      [NAME]: 'USDT',
      [SYMBOL]: 'USDT',
      [DECIMALS]: 18,
    },
    '0x9cbB6d11C08840fdc8744d0DFD353615EfC13B03': {
      [NAME]: 'BUSD',
      [SYMBOL]: 'BUSD',
      [DECIMALS]: 18,
    },
  },
  56: {
    // BSA mainnet
    '0x6B175474E89094C44Da98b954EedeAC495271d0F': {
      [NAME]: 'Dai Stablecoin',
      [SYMBOL]: 'DAI',
      [DECIMALS]: 18,
    },
    '0x57Ab1ec28D129707052df4dF418D58a2D46d5f51': {
      [NAME]: 'Synth sUSD',
      [SYMBOL]: 'sUSD',
      [DECIMALS]: 18,
    },
  },
  97: {
    // BSC testnet
    '0x6B175474E89094C44Da98b954EedeAC495271d0F': {
      [NAME]: 'Dai Stablecoin',
      [SYMBOL]: 'DAI',
      [DECIMALS]: 18,
    },
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': {
      [NAME]: 'Synth sUSD',
      [SYMBOL]: 'sUSD',
      [DECIMALS]: 18,
    },
  },
}

const TokensContext = createContext<TokensContext>([])

function useTokensContext() {
  return useContext(TokensContext)
}

function reducer(
  state: TokensState,
  { type, payload }: { type: 'UPDATE'; payload: any },
): TokensState {
  switch (type) {
    case UPDATE: {
      const { chainId, tokenAddress, name, symbol, decimals } = payload
      return {
        ...state,
        [chainId]: {
          ...(safeAccess(state, [chainId]) || {}),
          [tokenAddress]: {
            [NAME]: name,
            [SYMBOL]: symbol,
            [DECIMALS]: decimals,
          },
        },
      }
    }
    default: {
      throw Error(`Unexpected action type in TokensContext reducer: '${type}'.`)
    }
  }
}

export default function Provider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_TOKENS_CONTEXT)

  const update = useCallback(
    (chainId, tokenAddress, name, symbol, decimals, exchangeAddress) => {
      dispatch({
        type: UPDATE,
        payload: {
          chainId,
          tokenAddress,
          name,
          symbol,
          decimals,
          exchangeAddress,
        },
      })
    },
    [],
  )

  return (
    <TokensContext.Provider
      value={useMemo(() => [state, { update }], [state, update])}
    >
      {children}
    </TokensContext.Provider>
  )
}

export function useTokenDetails(tokenAddress: string) {
  const { chainId, library } = useWeb3React()

  const [state, { update }] = useTokensContext()
  const { [NAME]: name, [SYMBOL]: symbol, [DECIMALS]: decimals } =
    safeAccess(state, [chainId as ChainId, tokenAddress]) || {}

  useEffect(() => {
    if (
      isAddress(tokenAddress) &&
      (name === undefined || symbol === undefined || decimals === undefined) &&
      (chainId || chainId === 0) &&
      library
    ) {
      let stale = false

      const namePromise = getTokenName(tokenAddress, library).catch(() => null)
      const symbolPromise = getTokenSymbol(tokenAddress, library).catch(
        () => null,
      )
      const decimalsPromise = getTokenDecimals(tokenAddress, library).catch(
        () => null,
      )

      Promise.all([namePromise, symbolPromise, decimalsPromise]).then(
        ([resolvedName, resolvedSymbol, resolvedDecimals]) => {
          if (!stale) {
            update(
              chainId,
              tokenAddress,
              resolvedName,
              resolvedSymbol,
              resolvedDecimals,
            )
          }
        },
      )
      return () => {
        stale = true
      }
    }
  }, [tokenAddress, name, symbol, decimals, chainId, library, update])

  return { name, symbol, decimals }
}

export function useAllTokenDetails() {
  const { chainId } = useWeb3React()

  const [state] = useTokensContext()

  return useMemo(
    () => ({ ...(safeAccess(state, [chainId as ChainId]) || {}) }),
    [state, chainId],
  )
}
