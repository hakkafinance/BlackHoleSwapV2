import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  useEffect,
} from 'react'
import {
  Contract as MulticallContract,
  Provider as MulticallProvider,
} from '../vendors/ethers-multicall'
import { useBlockNumber } from './Application'
import { useWeb3React } from '../hooks/ethereum'
import { safeAccess, isAddress } from '../utils'
import { ChainId } from '../utils/types'
import EXCHANGE_ABI from '../constants/abis/WhiteHoleSwap.json'

type ExchangeContext = any[]

type ExchangeState = {}

const UPDATE = 'UPDATE'

const ExchangeContext = createContext<ExchangeContext>([])

export function useExchangeContext() {
  return useContext(ExchangeContext)
}

function reducer(
  state: ExchangeState,
  { type, payload }: { type: 'UPDATE'; payload: any },
): ExchangeState {
  switch (type) {
    case UPDATE: {
      const {
        chainId,
        exchangeAddress,
        aTokenReserve,
        bTokenReserve,
        totalSupply,
        fee,
        protocolFee,
        A,
        kLast,
        blockNumber,
      } = payload
      return {
        ...state,
        [chainId]: {
          ...safeAccess(state, [chainId]),
          [exchangeAddress]: {
            aTokenReserve,
            bTokenReserve,
            totalSupply,
            fee,
            protocolFee,
            A,
            kLast,
            blockNumber,
          },
        },
      }
    }
    default: {
      throw Error(
        `Unexpected action type in ExchangeContext reducer: '${type}'.`,
      )
    }
  }
}

export default function Provider({
  children,
}: {
  children: React.ReactNode
}): JSX.Element {
  const [state, dispatch] = useReducer(reducer, {})
  const update = useCallback(
    (
      chainId,
      exchangeAddress,
      aTokenReserve,
      bTokenReserve,
      totalSupply,
      fee,
      protocolFee,
      A,
      kLast,
      blockNumber,
    ) =>
      dispatch({
        type: UPDATE,
        payload: {
          chainId,
          exchangeAddress,
          aTokenReserve,
          bTokenReserve,
          totalSupply,
          fee,
          protocolFee,
          A,
          kLast,
          blockNumber,
        },
      }),
    [],
  )
  const value = useMemo(() => [state, { update }], [state, update])

  return (
    <ExchangeContext.Provider value={value}>
      {children}
    </ExchangeContext.Provider>
  )
}

export function useExchangeDetails(exchangeAddress: string) {
  const { chainId, library } = useWeb3React()

  const globalBlockNumber = useBlockNumber()

  const [state, { update }] = useExchangeContext()
  const {
    aTokenReserve,
    bTokenReserve,
    totalSupply,
    fee,
    protocolFee,
    A,
    kLast,
    blockNumber,
  } = safeAccess(state, [chainId as ChainId, exchangeAddress]) || {}

  useEffect(() => {
    let stale = false
    if (
      isAddress(exchangeAddress) &&
      globalBlockNumber &&
      blockNumber !== globalBlockNumber &&
      library
    ) {
      const ethcallProvider = new MulticallProvider(library, chainId as ChainId)
      const exchange = new MulticallContract(exchangeAddress, EXCHANGE_ABI)
      ethcallProvider
        .all([
          (exchange as any).getToken0Balance(),
          (exchange as any).getToken1Balance(),
          (exchange as any).totalSupply(),
          (exchange as any).fee(),
          (exchange as any).protocolFee(),
          (exchange as any).A(),
          (exchange as any).kLast(),
        ])
        .then(
          ([
            token0Balance,
            token1Balance,
            totalSupply,
            fee,
            protocolFee,
            A,
            kLast,
          ]) => {
            if (!stale) {
              update(
                chainId,
                exchangeAddress,
                token0Balance,
                token1Balance,
                totalSupply,
                fee,
                protocolFee,
                A,
                kLast,
                globalBlockNumber,
              )
            }
          },
        )
        .catch(() => {
          if (!stale) {
            update(
              chainId,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              globalBlockNumber,
            )
          }
        })
    }

    return () => {
      stale = true
    }
  }, [
    blockNumber,
    chainId,
    exchangeAddress,
    globalBlockNumber,
    library,
    update,
  ])

  return {
    aTokenReserve,
    bTokenReserve,
    totalSupply,
    fee,
    protocolFee,
    A,
    kLast,
  }
}
