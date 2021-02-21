import React, { useCallback, useMemo, useState, useEffect } from 'react'
import styled from 'styled-components'
import { Zero, MaxUint256 } from '@ethersproject/constants'
import { BigNumber } from '@ethersproject/bignumber'
import { parseUnits } from '@ethersproject/units'
import { useWeb3React, useExchangeContract } from '../hooks/ethereum'
import { useTokenDetails } from '../contexts/Tokens'
import { useAddressBalance } from '../contexts/Balances'
import { useAddressAllowance } from '../contexts/Allowances'
import { useExchangeDetails } from '../contexts/Exchange'
import { useTransactionAdder } from '../contexts/Transactions'
import { usePoolContext } from '../contexts/Pool'
import CoinInputPanel from '../components/CoinInputPanel'
import Button from '../components/Button'
import UnlockButton from '../components/UnlockButton'
import ReserveMatrics from '../components/ReserveMatrics'
import { amountFormatter, calculateGasMargin, getContract } from '../utils'
import { ChainId } from '../utils/types'
import { calculateSlippageBounds } from '../utils/calculation'
import { BASE, POOLS, GAS_MARGIN, TokenSymbolImage } from '../constants'
import ERC20_ABI from '../constants/abis/erc20.json'
import { ReactComponent as ArrowDownIcon } from '../assets/arrow_down.svg'

// denominated in bips
const ALLOWED_SLIPPAGE = BigNumber.from('200')

const Card = styled.div`
  padding: 36px 40px;
  background-color: ${({ theme }) => theme.colors.gray700};
`

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;

  &:not(:first-child) {
    margin-top: 20px;
  }
`

const CoinWrapper = styled.div`
  display: flex;
  align-items: center;

  > *:not(:first-child) {
    margin-left: 12px;
  }
`

const CoinIcon = styled.img`
  width: 32px;
  height: 32px;
`

const CoinText = styled.div`
  color: ${({ theme }) => theme.colors.white};
  font-size: 20px;
  font-weight: 600;
`

const Number = styled.div`
  color: ${({ theme }) => theme.colors.white};
  font-size: 32px;
  font-weight: 500;
`

const SummaryMessage = styled.div`
  margin-top: 50px;
  color: ${({ theme }) => theme.colors.white};
  font-size: 20px;
  font-weight: 500;
  line-height: 1.5;
`

const ErrorMessage = styled.div`
  margin-top: 20px;
  font-size: 14px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.orange};
  text-align: center;
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

function calculateReserveProportion(
  amount: BigNumber,
  totalAmount: BigNumber,
  reserve: BigNumber,
  mintFee: BigNumber,
): BigNumber {
  return totalAmount.isZero()
    ? Zero
    : amount.mul(reserve).div(totalAmount.add(mintFee))
}

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

function calculateMintFee(
  A: BigNumber,
  kLast: BigNumber,
  totalSupply: BigNumber,
  protocolFee: BigNumber,
  reserve0: BigNumber,
  reserve1: BigNumber,
): BigNumber {
  if (!kLast.isZero()) {
    const rootK = sqrt(k(A, reserve0, reserve1))
    const rootKLast = sqrt(kLast)
    if (rootK.gt(rootKLast)) {
      const numerator = totalSupply.mul(rootK.sub(rootKLast))
      const denominator = rootK.mul(protocolFee).add(rootKLast)
      const liquidity = numerator.div(denominator)
      return liquidity
    }
  }

  return Zero
}

export default function Deposit() {
  const { chainId, account, library } = useWeb3React()

  const addTransaction = useTransactionAdder()

  const [poolAddress] = usePoolContext()

  const pool = useMemo(() => POOLS?.[chainId as ChainId]?.[poolAddress], [
    chainId,
    poolAddress,
  ])

  const {
    aTokenReserve,
    bTokenReserve,
    totalSupply,
    protocolFee,
    A,
    kLast,
  } = useExchangeDetails(poolAddress)

  const { decimals: aTokenDecimals } = useTokenDetails(pool?.aTokenAddress)
  const { decimals: bTokenDecimals } = useTokenDetails(pool?.bTokenAddress)
  const aTokenBalance = useAddressBalance(
    pool?.aTokenAddress,
    account as string,
  )
  const bTokenBalance = useAddressBalance(
    pool?.bTokenAddress,
    account as string,
  )
  const aTokenAllowance = useAddressAllowance(
    pool?.aTokenAddress,
    account as string,
    poolAddress,
  )
  const bTokenAllowance = useAddressAllowance(
    pool?.bTokenAddress,
    account as string,
    poolAddress,
  )

  const poolTokenBalance = useAddressBalance(poolAddress, account as string)

  const [amount, setAmount] = useState('')
  const amountParsed = useMemo(() => {
    const value = amount || '0'
    return parseUnits(value, 18)
  }, [amount])

  const mintFee = useMemo(() => {
    if (
      !amountParsed.isZero() &&
      A &&
      kLast &&
      totalSupply &&
      protocolFee &&
      aTokenReserve &&
      bTokenReserve
    ) {
      return calculateMintFee(
        A,
        kLast,
        totalSupply,
        protocolFee,
        aTokenReserve,
        bTokenReserve,
      )
    }
  }, [
    A,
    aTokenReserve,
    amountParsed,
    bTokenReserve,
    kLast,
    protocolFee,
    totalSupply,
  ])

  // calculate the amount of DAI and USDC that should be depositted
  const aTokenAmount = useMemo(() => {
    if (!amountParsed.isZero() && totalSupply && aTokenReserve && mintFee) {
      return calculateReserveProportion(
        amountParsed,
        totalSupply,
        aTokenReserve,
        mintFee,
      )
    }
  }, [amountParsed, totalSupply, aTokenReserve, mintFee])

  const bTokenAmount = useMemo(() => {
    if (!amountParsed.isZero() && totalSupply && bTokenReserve && mintFee) {
      return calculateReserveProportion(
        amountParsed,
        totalSupply,
        bTokenReserve,
        mintFee,
      )
    }
  }, [amountParsed, totalSupply, bTokenReserve, mintFee])

  const aTokenAmountFormatted = aTokenAmount
    ? amountFormatter(aTokenAmount, aTokenDecimals, Math.min(4, aTokenDecimals))
    : '-'
  const bTokenAmountFormatted = bTokenAmount
    ? amountFormatter(bTokenAmount, bTokenDecimals, Math.min(4, bTokenDecimals))
    : '-'
  const {
    minimum: aTokenAmountMinimum,
    maximum: aTokenAmountMaximum,
  } = calculateSlippageBounds(aTokenAmount as BigNumber, ALLOWED_SLIPPAGE)
  const {
    minimum: bTokenAmountMinimum,
    maximum: bTokenAmountMaximum,
  } = calculateSlippageBounds(bTokenAmount as BigNumber, ALLOWED_SLIPPAGE)

  const summaryMessage = useMemo(() => {
    if (aTokenAmount && bTokenAmount) {
      return `
        You'll 
        ${aTokenAmount.gte(Zero) ? 'withdraw' : 'deposit'} 
        ${Math.abs(parseFloat(aTokenAmountFormatted))} ${pool?.aTokenSymbol}
        , and 
        ${bTokenAmount.gte(Zero) ? 'withdraw' : 'deposit'} 
        ${Math.abs(parseFloat(bTokenAmountFormatted))} ${pool?.bTokenSymbol}
      `
    }
  }, [
    aTokenAmount,
    aTokenAmountFormatted,
    bTokenAmount,
    bTokenAmountFormatted,
    pool,
  ])

  // validate input (pool balance + token allowance + token balance)
  const [inputError, setInputError] = useState('')
  useEffect(() => {
    setInputError('')
    if (amountParsed && poolTokenBalance && amountParsed.gt(poolTokenBalance)) {
      setInputError('Insufficient Balance')
    }

    return () => {
      setInputError('')
    }
  }, [
    amountParsed,
    aTokenAllowance,
    aTokenAmount,
    aTokenBalance,
    poolTokenBalance,
    bTokenAllowance,
    bTokenAmount,
    bTokenBalance,
  ])

  // Approve tokens
  const [isApprovingTokens, setIsApprovingTokens] = useState({
    [pool?.aTokenAddress]: false,
    [pool?.bTokenAddress]: false,
  })
  const approve = useCallback(
    async (tokenAddress) => {
      const token = getContract(
        tokenAddress,
        ERC20_ABI,
        library,
        account as string,
      )

      if (account && (chainId || chainId === 0) && token) {
        const balance =
          tokenAddress === pool?.aTokenAddress ? aTokenBalance : bTokenBalance
        let estimatedGas,
          useUserBalance = false
        try {
          estimatedGas = await token.estimateGas.approve(
            poolAddress,
            MaxUint256,
          )
        } catch {
          estimatedGas = await token.estimateGas.approve(poolAddress, balance)
          useUserBalance = true
        }

        try {
          const tx = await token.approve(
            poolAddress,
            useUserBalance ? balance : MaxUint256,
            {
              gasLimit: calculateGasMargin(estimatedGas, GAS_MARGIN),
            },
          )
          setIsApprovingTokens((prevState) => ({
            ...prevState,
            [tokenAddress]: true,
          }))
          addTransaction(tx)
          await tx.wait()
        } finally {
          setIsApprovingTokens((prevState) => ({
            ...prevState,
            [tokenAddress]: false,
          }))
        }
      }
    },
    [
      library,
      account,
      chainId,
      pool,
      aTokenBalance,
      bTokenBalance,
      poolAddress,
      addTransaction,
    ],
  )

  // remove Liquidity
  const exchangeContract = useExchangeContract(poolAddress)
  const [isPending, setIsPending] = useState(false)
  const onRemoveLiquidity = useCallback(async () => {
    if (exchangeContract && amountParsed && aTokenReserve && bTokenReserve) {
      try {
        const estimatedGas = await exchangeContract.estimateGas.removeLiquidity(
          amountParsed,
          aTokenAmountMinimum,
          bTokenAmountMinimum,
        )
        const tx = await exchangeContract.removeLiquidity(
          amountParsed,
          aTokenAmountMinimum,
          bTokenAmountMinimum,
          {
            gasLimit: calculateGasMargin(estimatedGas, GAS_MARGIN),
          },
        )
        setIsPending(true)
        addTransaction(tx)
        await tx.wait()
      } finally {
        setIsPending(false)
      }
    }
  }, [
    addTransaction,
    amountParsed,
    aTokenAmountMinimum,
    aTokenReserve,
    exchangeContract,
    bTokenAmountMinimum,
    bTokenReserve,
  ])

  const accountError = useMemo(
    () => (account ? '' : 'Wallet is not connected.'),
    [account],
  )

  const noAmountError = useMemo(() => !parseFloat(amount), [amount])

  const errorMessage = accountError || noAmountError || inputError

  return (
    <>
      <Card>
        <CoinInputPanel
          title='How many positions do you withdraw?'
          selectedCoin={poolAddress}
          value={amount}
          onValueChange={(value) => setAmount(value)}
        />
        <StyledArrowDownIcon />
        <div>
          <Row>
            <CoinWrapper>
              <CoinIcon
                src={(TokenSymbolImage as any)[pool?.aTokenSymbol]}
                alt={`icon ${pool?.aTokenSymbol}`}
              />
              <CoinText>{pool?.aTokenSymbol}</CoinText>
            </CoinWrapper>
            <Number>{aTokenAmountFormatted}</Number>
          </Row>
          <Row>
            <CoinWrapper>
              <CoinIcon
                src={(TokenSymbolImage as any)[pool?.bTokenSymbol]}
                alt={`icon ${pool?.bTokenSymbol}`}
              />
              <CoinText>{pool?.bTokenSymbol}</CoinText>
            </CoinWrapper>
            <Number>{bTokenAmountFormatted}</Number>
          </Row>
        </div>
        <SummaryMessage>{summaryMessage}</SummaryMessage>
        <ButtonWrapper>
          <Button
            disabled={!!errorMessage || isPending}
            onClick={onRemoveLiquidity}
          >
            {isPending ? 'Pending...' : 'withdraw'}
          </Button>
        </ButtonWrapper>
        <ErrorMessage>{errorMessage}</ErrorMessage>
      </Card>
      <ReserveMatrics
        hasAccount={!!account}
        aTokenSymbol={pool?.aTokenSymbol}
        bTokenSymbol={pool?.bTokenSymbol}
        aTokenBalance={aTokenBalance}
        bTokenBalance={bTokenBalance}
        bhsBalance={poolTokenBalance}
        aTokenReserve={aTokenReserve}
        bTokenReserve={bTokenReserve}
        amplifier={A}
        totalSupply={totalSupply}
      />
    </>
  )
}
