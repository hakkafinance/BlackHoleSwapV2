import React, {
  createContext,
  useContext,
  useReducer,
  useMemo,
  useCallback,
  useEffect
} from 'react'
import { useSnackbar } from './Snackbar'
import { useWeb3React } from '../hooks/ethereum'
import {
  safeAccess,
  shortenTransactionHash,
  getEtherscanLink,
  ChainId
} from '../utils'
import { useBlockNumber } from './Application'

type TransactionsContext = any[]

type TransactionsState = {}

type TransactionsAction = {
  type: 'ADD' | 'CHECK' | 'FINALIZE'
  payload: any
}

const RESPONSE = 'response'
const CUSTOM_DATA = 'CUSTOM_DATA'
const BLOCK_NUMBER_CHECKED = 'BLOCK_NUMBER_CHECKED'
const RECEIPT = 'receipt'

const ADD = 'ADD'
const CHECK = 'CHECK'
const FINALIZE = 'FINALIZE'

const TransactionsContext = createContext<TransactionsContext>([])

export function useTransactionsContext() {
  return useContext(TransactionsContext)
}

function reducer(
  state: TransactionsState,
  { type, payload }: TransactionsAction
): TransactionsState {
  switch (type) {
    case ADD: {
      const { networkId, hash, response } = payload

      if (safeAccess(state, [networkId, hash]) !== null) {
        throw Error('Attempted to add existing transaction.')
      }

      return {
        ...state,
        [networkId]: {
          ...(safeAccess(state, [networkId]) || {}),
          [hash]: {
            [RESPONSE]: response
          }
        }
      }
    }
    case CHECK: {
      const { networkId, hash, blockNumber } = payload

      if (safeAccess(state, [networkId, hash]) === null) {
        throw Error('Attempted to check non-existent transaction.')
      }

      return {
        ...state,
        [networkId]: {
          ...(safeAccess(state, [networkId]) || {}),
          [hash]: {
            ...(safeAccess(state, [networkId, hash]) || {}),
            [BLOCK_NUMBER_CHECKED]: blockNumber
          }
        }
      }
    }
    case FINALIZE: {
      const { networkId, hash, receipt } = payload

      if (safeAccess(state, [networkId, hash]) === null) {
        throw Error('Attempted to finalize non-existent transaction.')
      }

      return {
        ...state,
        [networkId]: {
          ...(safeAccess(state, [networkId]) || {}),
          [hash]: {
            ...(safeAccess(state, [networkId, hash]) || {}),
            [RECEIPT]: receipt
          }
        }
      }
    }
    default: {
      throw Error(`Unexpected action type in TransactionsContext reducer: '${type}'.`)
    }
  }
}

export default function Provider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {})

  const add = useCallback((networkId, hash, response) => {
    dispatch({ type: ADD, payload: { networkId, hash, response } })
  }, [])
  const check = useCallback((networkId, hash, blockNumber) => {
    dispatch({ type: CHECK, payload: { networkId, hash, blockNumber } })
  }, [])
  const finalize = useCallback((networkId, hash, receipt) => {
    dispatch({ type: FINALIZE, payload: { networkId, hash, receipt } })
  }, [])

  return (
    <TransactionsContext.Provider
      value={useMemo(() => [state, { add, check, finalize }], [state, add, check, finalize])}
    >
      {children}
    </TransactionsContext.Provider>
  )
}

export function Updater() {
  const { chainId, library } = useWeb3React()

  const globalBlockNumber = useBlockNumber()

  const [state, { check, finalize }] = useTransactionsContext()
  const allTransactions = safeAccess(state, [chainId as ChainId]) || {}

  useEffect(() => {
    if ((chainId || chainId === 0) && library) {
      let stale = false
      Object.keys(allTransactions)
        .filter(
          hash => !allTransactions[hash][RECEIPT] && allTransactions[hash][BLOCK_NUMBER_CHECKED] !== globalBlockNumber
        )
        .forEach(hash => {
          library
            .getTransactionReceipt(hash)
            .then((receipt: any) => {
              if (!stale) {
                if (!receipt) {
                  check(chainId, hash, globalBlockNumber)
                } else {
                  finalize(chainId, hash, receipt)
                }
              }
            })
            .catch(() => {
              check(chainId, hash, globalBlockNumber)
            })
        })

      return () => {
        stale = true
      }
    }
  }, [chainId, library, allTransactions, globalBlockNumber, check, finalize])

  return null
}

function renderSnackbarContent(hash: string, chainId: ChainId): JSX.Element {
  return (
    <article>
      <div>Your Transaction: </div>
      <a
        href={getEtherscanLink(chainId, hash, 'transaction')}
        target='_blank'
        rel='noopener noreferrer'
      >{shortenTransactionHash(hash)}</a>
    </article>
  )
}

export function useTransactionAdder() {
  const { chainId } = useWeb3React()

  const [, { add }] = useTransactionsContext()

  const { enqueueSnackbar } = useSnackbar()

  return useCallback(
    (response, customData = {}) => {
      if (!(chainId || chainId === 0)) {
        throw Error(`Invalid networkId '${chainId}`)
      }

      const hash = safeAccess(response, ['hash'])

      if (!hash) {
        throw Error('No transaction hash found.')
      }
      add(chainId, hash, { ...response, [CUSTOM_DATA]: customData })
      enqueueSnackbar(renderSnackbarContent(hash, chainId as ChainId))
    },
    [chainId, add, enqueueSnackbar]
  )
}

export function useAllTransactions() {
  const { chainId } = useWeb3React()

  const [state] = useTransactionsContext()

  return safeAccess(state, [chainId as ChainId]) || {}
}

export function usePendingApproval(tokenAddress: string): boolean {
  const allTransactions = useAllTransactions()

  return (
    Object.keys(allTransactions).filter(hash => {
      if (allTransactions[hash][RECEIPT]) {
        return false
      } else if (!allTransactions[hash][RESPONSE]) {
        return false
      } else if (allTransactions[hash][RESPONSE][CUSTOM_DATA].approval !== tokenAddress) {
        return false
      } else {
        return true
      }
    }).length >= 1
  )
}
