import React, {
  useReducer,
  useCallback,
  useMemo,
  useState,
  useEffect,
} from 'react'
import styled from 'styled-components'
import { Zero, MaxUint256, WeiPerEther } from '@ethersproject/constants'
import { BigNumber } from '@ethersproject/bignumber'
import { parseUnits } from '@ethersproject/units'
import { useWeb3React, useExchangeContract } from '../hooks/ethereum'
import { useTokenDetails } from '../contexts/Tokens'
import { useAddressBalance } from '../contexts/Balances'
import { useAddressAllowance } from '../contexts/Allowances'
import { useExchangeDetails } from '../contexts/Exchange'
import { useTransactionAdder } from '../contexts/Transactions'
import { usePoolContext } from '../contexts/Pool'
import { BASE, POOLS, GAS_MARGIN } from '../constants'
import { amountFormatter, calculateGasMargin } from '../utils'
import { ChainId } from '../utils/types'
import {
  calculateSlippageBounds,
  calculateExchangeRate,
} from '../utils/calculation'
import CoinInputPanel from '../components/CoinInputPanel'
import SlippageController from '../components/SlippageController'
import Button from '../components/Button'
import { ReactComponent as ArrowDownIcon } from '../assets/arrow_down.svg'

const Card = styled.div`
  padding: 36px 40px;
  background-color: ${({ theme }) => theme.colors.gray700};
`

const StyledArrowDownIcon = styled(ArrowDownIcon)`
  width: 24px;
  height: 24px;
  margin: 20px 0;
`

const ButtonWrapper = styled.div`
  margin-top: 50px;
  display: flex;
  justify-content: center;
`

const ErrorMessage = styled.div`
  margin-top: 20px;
  font-size: 14px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.orange};
  text-align: center;
`

// 15 minutes, denominated in seconds
const DEFAULT_DEADLINE_FROM_NOW = 60 * 15

// denominated in bips
const ALLOWED_SLIPPAGE_DEFAULT = 10

const INPUT = 'INPUT'
const OUTPUT = 'OUTPUT'
const RESET = 'RESET'
const SELECT_COIN = 'SELECT_COIN'
const UPDATE_INDEPENDENT = 'UPDATE_INDEPENDENT'
const UPDATE_DEPENDENT = 'UPDATE_DEPENDENT'

function sqrt(x: BigNumber): BigNumber {
  let z = x.div(2).add(1)
  let y = x
  while (z.lt(y)) {
    y = z
    z = x.div(z).add(z).div(2)
  }
  return y
}

function k(A: BigNumber, x: BigNumber, y: BigNumber): BigNumber {
  const u = x.add(y.mul(A).div(BASE))
  const v = y.add(x.mul(A).div(BASE))
  const _k = u.mul(v)

  return _k
}

function f(_x: BigNumber, x: BigNumber, y: BigNumber, A: BigNumber): BigNumber {
  const c = k(A, x, y).mul(BASE).div(A).sub(_x.mul(_x))
  if (c.lt(Zero)) {
    throw Error('Insufficient liquidity')
  }

  const cst = A.add(BASE.mul(BASE).div(A))
  const _b = _x.mul(cst).div(BASE)
  const D = _b.mul(_b).add(c.mul(4))

  if (D.lt(Zero)) {
    throw Error('no root')
  }

  return sqrt(D).sub(_b).div(2)
}

// this mocks the getInputPrice function, and calculates the required output
function calculateInputPrice(
  inputAmount: BigNumber,
  inputReserve: BigNumber,
  outputReserve: BigNumber,
  fee: BigNumber,
  amplifier: BigNumber,
) {
  const x = inputReserve
  const y = outputReserve
  const inputAmountWithFee = inputAmount.mul(fee).div(BASE)
  const _x = x.add(inputAmountWithFee)
  const _y = f(_x, x, y, amplifier)
  return y.sub(_y)
}

// this mocks the getOutputPrice function, and calculates the required input
function calculateOutputPrice(
  outputAmount: BigNumber,
  inputReserve: BigNumber,
  outputReserve: BigNumber,
  fee: BigNumber,
  amplifier: BigNumber,
): BigNumber {
  const x = inputReserve
  const y = outputReserve
  const _y = y.sub(outputAmount)
  const _x = f(_y, y, x, amplifier)

  const inputAmount = _x.sub(x)
  const inputAmountWithFee = inputAmount.mul(WeiPerEther).div(fee)

  return inputAmountWithFee
}

type InitialSwapState = {
  allCoins: string[]
}

type SwapState = {
  allCoins: string[]
  independentValue?: string
  dependentValue?: BigNumber
  independentField?: string
  inputCoin: string
  outputCoin: string
}

type SwapAction = {
  type: 'RESET' | 'SELECT_COIN' | 'UPDATE_INDEPENDENT' | 'UPDATE_DEPENDENT'
  payload: any
}

function getInitialSwapState(state: InitialSwapState): SwapState {
  return {
    allCoins: state.allCoins,
    independentValue: '', // this is a user input
    dependentValue: undefined, // this is a calculated number
    independentField: INPUT,
    inputCoin: state.allCoins[0],
    outputCoin: state.allCoins[1],
  }
}

function getOtherCoin(
  allCoins: string[],
  selectedCoin: string,
  defaultCoin: string,
) {
  const otherCoins = allCoins.filter((coin) => coin !== selectedCoin)
  return otherCoins.includes(defaultCoin) ? defaultCoin : otherCoins[0]
}

function reducer(state: SwapState, { type, payload }: SwapAction): SwapState {
  switch (type) {
    case RESET: {
      return { ...payload }
    }
    case SELECT_COIN: {
      const { allCoins, inputCoin, outputCoin } = state
      const { coin, field } = payload

      const newInputCoin =
        field === INPUT ? coin : getOtherCoin(allCoins, coin, inputCoin)
      const newOutputCoin =
        field === OUTPUT ? coin : getOtherCoin(allCoins, coin, outputCoin)

      return {
        ...state,
        inputCoin: newInputCoin,
        outputCoin: newOutputCoin,
      }
    }
    case UPDATE_INDEPENDENT: {
      const { field, value } = payload
      const { dependentValue, independentValue } = state
      return {
        ...state,
        independentValue: value,
        dependentValue: value === independentValue ? dependentValue : undefined,
        independentField: field,
      }
    }
    case UPDATE_DEPENDENT: {
      const { independentField, inputCoin, outputCoin, allCoins } = state
      const dependentCoin = independentField === INPUT ? outputCoin : inputCoin
      const value = dependentCoin === allCoins[0] ? payload : payload
      return {
        ...state,
        dependentValue: value,
      }
    }
    default: {
      return getInitialSwapState(state)
    }
  }
}

export default function Swap() {
  const { account, chainId } = useWeb3React()

  const addTransaction = useTransactionAdder()

  const [poolAddress] = usePoolContext()

  const pool = useMemo(() => POOLS?.[chainId as ChainId]?.[poolAddress], [
    chainId,
    poolAddress,
  ])

  const { aTokenReserve, bTokenReserve, fee, A } = useExchangeDetails(
    poolAddress,
  )

  const coinOptions = useMemo(
    () =>
      chainId && pool
        ? [
            {
              text: pool?.aTokenSymbol,
              value: pool?.aTokenAddress,
            },
            {
              text: pool?.bTokenSymbol,
              value: pool?.bTokenAddress,
            },
          ]
        : undefined,
    [chainId, pool],
  )

  const [state, dispatch] = useReducer(
    reducer,
    { allCoins: [] },
    getInitialSwapState,
  )
  const {
    independentValue,
    dependentValue,
    independentField,
    inputCoin,
    outputCoin,
  } = state

  useEffect(() => {
    if (chainId && pool) {
      dispatch({
        type: RESET,
        payload: getInitialSwapState({
          allCoins: [pool?.aTokenAddress, pool?.bTokenAddress],
        }),
      })
    }

    return () => {}
  }, [chainId, pool])

  // get decimals for each of the currency types
  const { decimals: inputDecimals } = useTokenDetails(inputCoin)
  const { decimals: outputDecimals } = useTokenDetails(outputCoin)

  // compute useful transforms of the data above
  const independentDecimals = useMemo(
    () => (independentField === INPUT ? inputDecimals : outputDecimals),
    [independentField, inputDecimals, outputDecimals],
  )
  const dependentDecimals = useMemo(
    () => (independentField === INPUT ? outputDecimals : inputDecimals),
    [independentField, inputDecimals, outputDecimals],
  )

  // declare/get parsed and formatted versions of input/output values
  const [independentValueParsed, setIndependentValueParsed] = useState<
    BigNumber
  >()
  const [independentValueNormalized, setIndependentValueNormalized] = useState<
    BigNumber
  >()
  const dependentValueFormatted = useMemo(() => {
    if (!!(dependentValue && (dependentDecimals || dependentDecimals === 0))) {
      return amountFormatter(
        dependentValue,
        dependentDecimals,
        Math.min(8, dependentDecimals),
      )
    } else {
      return ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependentValue])
  const inputValueParsed =
    independentField === INPUT ? independentValueParsed : dependentValue
  const inputValueFormatted =
    independentField === INPUT ? independentValue : dependentValueFormatted
  const outputValueParsed =
    independentField === OUTPUT ? independentValueParsed : dependentValue
  const outputValueFormatted =
    independentField === OUTPUT ? independentValue : dependentValueFormatted

  // calculate exchange rate
  const exchangeRate = useMemo(() => {
    if (inputValueParsed && outputValueParsed) {
      return calculateExchangeRate(
        inputValueParsed,
        inputDecimals,
        outputValueParsed,
        outputDecimals,
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValueParsed, outputValueParsed])

  const exchangeRateFormatted = exchangeRate
    ? amountFormatter(exchangeRate, 18, 6)
    : '-'

  // validate + parse independent value
  const [independentError, setIndependentError] = useState('')
  useEffect(() => {
    if (
      independentValue &&
      (independentDecimals || independentDecimals === 0)
    ) {
      try {
        const parsedValue = parseUnits(independentValue, independentDecimals)
        const normalizedValue = parseUnits(independentValue, 18)

        if (parsedValue.lte(Zero) || parsedValue.gte(MaxUint256)) {
          throw Error()
        } else {
          setIndependentValueParsed(parsedValue)
          setIndependentValueNormalized(normalizedValue)
          setIndependentError('')
        }
      } catch {
        setIndependentError('Not a valid input value')
      }

      return () => {
        setIndependentValueParsed(undefined)
        setIndependentValueNormalized(undefined)
        setIndependentError('')
      }
    }
  }, [independentValue, independentDecimals])

  const [rawSlippage, setRawSlippage] = useState(() => ALLOWED_SLIPPAGE_DEFAULT)
  const allowedSlippageBig = BigNumber.from(rawSlippage)

  // calculate slippage from target rate
  const {
    minimum: dependentValueMinumum,
    maximum: dependentValueMaximum,
  } = calculateSlippageBounds(dependentValue as BigNumber, allowedSlippageBig)

  // get allowances and balances of inputCoin
  const inputAllowance = useAddressAllowance(
    inputCoin,
    account as string,
    poolAddress,
  )

  const inputBalance = useAddressBalance(inputCoin, account as string)

  // validate input allowance + balance
  const [inputError, setInputError] = useState('')
  const [showUnlock, setShowUnlock] = useState(false)
  useEffect(() => {
    const inputValueCalculation =
      independentField === INPUT
        ? independentValueParsed
        : dependentValueMaximum
    if (inputBalance && inputAllowance && inputValueCalculation) {
      if (inputBalance.lt(inputValueCalculation)) {
        setInputError('Insufficient Balance')
      } else if (inputAllowance.lt(inputValueCalculation)) {
        setInputError('Please unlock token to continue.')
        setShowUnlock(true)
      } else {
        setInputError('')
        setShowUnlock(false)
      }
      return () => {
        setInputError('')
        setShowUnlock(false)
      }
    }
  }, [
    independentField,
    independentValueParsed,
    dependentValueMaximum,
    inputBalance,
    inputCoin,
    inputAllowance,
  ])

  const inputReserve = useMemo(
    () => (inputCoin === pool?.aTokenAddress ? aTokenReserve : bTokenReserve),
    [inputCoin, pool, aTokenReserve, bTokenReserve],
  )
  const outputReserve = useMemo(
    () => (outputCoin === pool?.aTokenAddress ? aTokenReserve : bTokenReserve),
    [outputCoin, pool, aTokenReserve, bTokenReserve],
  )

  const exchangeContract = useExchangeContract(poolAddress)

  // calculate dependent value
  useEffect(() => {
    if (
      independentValueNormalized &&
      inputReserve &&
      outputReserve &&
      exchangeContract
    ) {
      const amount = independentValueNormalized

      try {
        if (inputReserve.isZero() || outputReserve.isZero()) {
          throw Error('Insufficient liquidity.')
        }

        const calculatedDependentValue =
          independentField === INPUT
            ? calculateInputPrice(amount, inputReserve, outputReserve, fee, A)
            : calculateOutputPrice(amount, inputReserve, outputReserve, fee, A)

        if (calculatedDependentValue.lte(Zero)) {
          throw Error('Insufficient liquidity.')
        }

        dispatch({
          type: UPDATE_DEPENDENT,
          payload: calculatedDependentValue,
        })
        setIndependentError('')
      } catch (e) {
        setIndependentError(e.message)
      }
      return () => {
        dispatch({ type: UPDATE_DEPENDENT, payload: '' })
      }
    }
  }, [
    A,
    dependentDecimals,
    exchangeContract,
    fee,
    independentField,
    independentValueNormalized,
    inputReserve,
    outputReserve,
  ])

  const [isPending, setIsPending] = useState(false)
  const onSwap = useCallback(async () => {
    if (!exchangeContract) return

    const deadline = Math.ceil(Date.now() / 1000) + DEFAULT_DEADLINE_FROM_NOW
    let estimate, method, args

    if (independentField === INPUT) {
      if (inputCoin === pool?.aTokenAddress) {
        method = exchangeContract.token0In
        estimate = exchangeContract.estimateGas.token0In
        args = [independentValueParsed, dependentValueMinumum, deadline]
      } else {
        method = exchangeContract.token1In
        estimate = exchangeContract.estimateGas.token1In
        args = [independentValueParsed, dependentValueMinumum, deadline]
      }
    } else {
      if (outputCoin === pool?.aTokenAddress) {
        method = exchangeContract.token1Out
        estimate = exchangeContract.estimateGas.token1Out
        args = [dependentValueMaximum, independentValueParsed, deadline]
      } else {
        method = exchangeContract.token0Out
        estimate = exchangeContract.estimateGas.token0Out
        args = [dependentValueMaximum, independentValueParsed, deadline]
      }
    }

    try {
      const estimatedGas = await estimate(...args)
      const tx = await method(...args, {
        gasLimit: calculateGasMargin(estimatedGas, GAS_MARGIN),
      })
      setIsPending(true)
      addTransaction(tx)
      await tx.wait()
    } finally {
      setIsPending(false)
    }

    return () => {
      setIsPending(false)
    }
  }, [
    addTransaction,
    dependentValueMaximum,
    dependentValueMinumum,
    exchangeContract,
    independentField,
    independentValueParsed,
    inputCoin,
    outputCoin,
    pool,
  ])

  const noAccountError = useMemo(
    () => (account ? '' : 'Wallet is not connected.'),
    [account],
  )

  const noAmountError = useMemo(() => !independentValue, [independentValue])

  const errorMessage =
    noAccountError || noAmountError || independentError || inputError

  return (
    <Card>
      <CoinInputPanel
        title='From'
        coinOptions={coinOptions}
        selectedCoin={inputCoin}
        value={inputValueFormatted || ''}
        showUnlock={showUnlock}
        onCoinChange={(coin) =>
          dispatch({ type: SELECT_COIN, payload: { coin, field: INPUT } })
        }
        onValueChange={(value) =>
          dispatch({
            type: UPDATE_INDEPENDENT,
            payload: { field: INPUT, value },
          })
        }
      />
      <StyledArrowDownIcon />
      <CoinInputPanel
        title='To'
        coinOptions={coinOptions}
        selectedCoin={outputCoin}
        value={outputValueFormatted || ''}
        onCoinChange={(coin) =>
          dispatch({ type: SELECT_COIN, payload: { coin, field: OUTPUT } })
        }
        onValueChange={(value) =>
          dispatch({
            type: UPDATE_INDEPENDENT,
            payload: { field: OUTPUT, value },
          })
        }
        renderInputMessage={() => <span>Rate: {exchangeRateFormatted}</span>}
      />
      <SlippageController onChange={setRawSlippage} />
      <ButtonWrapper>
        <Button disabled={!!errorMessage || isPending} onClick={onSwap}>
          {isPending ? 'Pending...' : 'swap'}
        </Button>
      </ButtonWrapper>
      <ErrorMessage>{errorMessage}</ErrorMessage>
    </Card>
  )
}
