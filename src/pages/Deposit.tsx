import React, { useCallback, useMemo, useState, useEffect } from 'react'
import styled from 'styled-components'
import { Zero, MaxUint256 } from '@ethersproject/constants'
import { BigNumber } from '@ethersproject/bignumber'
import { parseUnits } from '@ethersproject/units'
import { useWeb3React, useExchangeContract } from '../hooks/ethereum'
import { useTokenDetails } from '../contexts/Tokens'
import { useAddressAllowance } from '../contexts/Allowances'
import { useAddressBalance } from '../contexts/Balances'
import { useExchangeDetails } from '../contexts/Exchange'
import { useTransactionAdder } from '../contexts/Transactions'
import { usePoolContext } from '../contexts/Pool'
import CoinInputPanel from '../components/CoinInputPanel'
import UnlockButton from '../components/UnlockButton'
import Button from '../components/Button'
import ReserveMatrics from '../components/ReserveMatrics'
import Dialog from '../components/Dialog'
import Checkbox from '../components/Checkbox'
import DepositSelector from '../components/DepositSelector'
import { amountFormatter, calculateGasMargin, getContract } from '../utils'
import { ChainId } from '../utils/types'
import { calculateSlippageBounds } from '../utils/calculation'
import { BASE, POOLS, GAS_MARGIN, TokenSymbolImage } from '../constants'
import ERC20_ABI from '../constants/abis/erc20.json'
import { ReactComponent as ArrowDownIcon } from '../assets/arrow_down.svg'
import { ReactComponent as CautionIcon } from '../assets/caution.svg'
import { ReactComponent as PlusIcon } from '../assets/plus.svg'

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

const UnlockWrapper = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
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

const StyledPlusIcon = styled(PlusIcon)`
  width: 24px;
  height: 24px;
  margin: 20px 0;
`

const ButtonWrapper = styled.div`
  margin-top: 50px;
  display: flex;
  justify-content: center;
`

const CheckboxWrapper = styled.div`
  &:not(:first-child) {
    margin-top: 20px;
  }
`

const DialogContent = styled.div`
  padding: 8px 40px 40px 40px;
`

const DialogTitle = styled.div`
  margin-top: 20px;
  margin-bottom: 56px;
  color: ${({ theme }) => theme.colors.white};
  font-size: 20px;
  font-weight: 500;
  line-height: 1.5;
`

const DialogSubTitle = styled.div`
  margin-bottom: 20px;
  font-size: 14px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.orange};
`

const GetShareLabel = styled.div`
  margin-bottom: 10px;
  font-size: 20px;
  font-weight: 500;
`

const GetShareAmount = styled.div`
  margin-bottom: 20px;
  font-size: 32px;
  font-weight: 300;
  color: ${({ theme }) => theme.colors.gray300};
`

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

function calculateReserveProportion(
  amount: BigNumber,
  totalAmount: BigNumber,
  reserve: BigNumber,
): BigNumber {
  return totalAmount.isZero()
    ? amount.div(BigNumber.from('2'))
    : amount.mul(reserve).div(totalAmount)
}

function calculateShareProportion(
  fee: BigNumber,
  protocolFee: BigNumber,
  A: BigNumber,
  kLast: BigNumber,
  totalSupply: BigNumber,
  token0_in: BigNumber,
  token1_in: BigNumber,
  token0Reserve: BigNumber,
  token1Reserve: BigNumber,
): BigNumber {
  if (token0Reserve.isZero() && token1Reserve.isZero()) return Zero

  const kBefore = k(A, token0Reserve, token1Reserve)
  const kAfter = k(
    A,
    token0Reserve.add(token0_in.mul(fee).div(BASE)),
    token1Reserve.add(token1_in.mul(fee).div(BASE)),
  )
  const mintFee = calculateMintFee(
    A,
    kLast,
    totalSupply,
    protocolFee,
    token0Reserve,
    token1Reserve,
  )

  return sqrt(kAfter)
    .mul(totalSupply.add(mintFee))
    .div(sqrt(kBefore))
    .sub(totalSupply.add(mintFee))
}

export default function Deposit(): JSX.Element {
  const { chainId, account, library } = useWeb3React()

  const addTransaction = useTransactionAdder()

  const [poolAddress] = usePoolContext()

  const pool = useMemo(() => POOLS?.[chainId as ChainId]?.[poolAddress], [
    chainId,
    poolAddress,
  ])

  const {
    fee,
    protocolFee,
    A,
    kLast,
    aTokenReserve,
    bTokenReserve,
    totalSupply,
  } = useExchangeDetails(poolAddress)

  const bhsBalance = useAddressBalance(poolAddress, account as string)

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

  //for page switch
  const [isCustomPage, setIsCustomPage] = useState(false)

  //for customPage CoinInputPanel
  const [customTokenAAmount, setCustomTokenAAmount] = useState('')
  const [customTokenBAmount, setCustomTokenBAmount] = useState('')
  const customTokenAAmountParsed = useMemo(
    () => parseUnits(customTokenAAmount || '0', 18),
    [customTokenAAmount],
  )
  const customTokenBAmountParsed = useMemo(
    () => parseUnits(customTokenBAmount || '0', 18),
    [customTokenBAmount],
  )

  const [amount, setAmount] = useState('')
  const amountParsed = useMemo(() => parseUnits(amount || '0', 18), [amount])

  useEffect(() => {
    if (isCustomPage) {
      setAmount('')
    } else {
      setCustomTokenAAmount('')
      setCustomTokenBAmount('')
    }
  }, [isCustomPage])

  // calculate the amount of DAI and USDC that should be depositted
  const shareTokenAmount = useMemo(() => {
    if (
      (!customTokenAAmountParsed.isZero() ||
        !customTokenBAmountParsed.isZero()) &&
      totalSupply &&
      aTokenReserve
    ) {
      return calculateShareProportion(
        fee,
        protocolFee,
        A,
        kLast,
        totalSupply,
        customTokenAAmountParsed,
        customTokenBAmountParsed,
        aTokenReserve,
        bTokenReserve,
      )
    }
  }, [
    customTokenAAmountParsed,
    customTokenBAmountParsed,
    totalSupply,
    aTokenReserve,
    fee,
    protocolFee,
    A,
    kLast,
    bTokenReserve,
  ])

  const {
    minimum: shareTokenAmountMinimum,
    maximum: shareTokenAmountMaximum,
  } = calculateSlippageBounds(shareTokenAmount as BigNumber, ALLOWED_SLIPPAGE)

  const shareTokenAmountFormatted = shareTokenAmount
    ? amountFormatter(
        shareTokenAmount,
        bTokenDecimals,
        Math.min(4, bTokenDecimals),
      )
    : '-'

  // calculate the amount of DAI and USDC that should be depositted
  const aTokenAmount = useMemo(() => {
    if (isCustomPage) {
      if (!customTokenAAmountParsed.isZero()) {
        return customTokenAAmountParsed
      }
    } else {
      if (!amountParsed.isZero() && totalSupply && aTokenReserve) {
        return calculateReserveProportion(
          amountParsed,
          totalSupply,
          aTokenReserve,
        )
      }
    }
  }, [
    isCustomPage,
    customTokenAAmountParsed,
    amountParsed,
    totalSupply,
    aTokenReserve,
  ])

  const bTokenAmount = useMemo(() => {
    if (isCustomPage) {
      if (!customTokenBAmountParsed.isZero()) {
        return customTokenBAmountParsed
      }
    } else {
      if (!amountParsed.isZero() && totalSupply && bTokenReserve) {
        return calculateReserveProportion(
          amountParsed,
          totalSupply,
          bTokenReserve,
        )
      }
    }
  }, [
    isCustomPage,
    customTokenBAmountParsed,
    amountParsed,
    totalSupply,
    bTokenReserve,
  ])

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
        ${aTokenAmount.gte(Zero) ? 'deposit' : 'recieve'} 
        ${Math.abs(parseFloat(aTokenAmountFormatted))} ${pool?.aTokenSymbol}
        , and 
        ${bTokenAmount.gte(Zero) ? 'deposit' : 'recieve'} 
        ${Math.abs(parseFloat(bTokenAmountFormatted))} ${pool?.bTokenSymbol}
      `
    } else if (aTokenAmount) {
      return `
        You'll 
        ${aTokenAmount.gte(Zero) ? 'deposit' : 'recieve'} 
        ${Math.abs(parseFloat(aTokenAmountFormatted))} ${pool?.aTokenSymbol}
      `
    } else if (bTokenAmount) {
      return `
        You'll 
        ${bTokenAmount.gte(Zero) ? 'deposit' : 'recieve'} 
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

  // validate input allowance + balance
  const [inputError, setInputError] = useState('')
  const [showATokenUnlock, setShowATokenUnlock] = useState(false)
  const [showBTokenUnlock, setShowBTokenUnlock] = useState(false)
  useEffect(() => {
    if (
      aTokenAmount &&
      aTokenBalance &&
      aTokenAllowance &&
      bTokenAmount &&
      bTokenBalance &&
      bTokenAllowance
    ) {
      if (aTokenBalance.lt(aTokenAmount) || bTokenBalance.lt(bTokenAmount)) {
        setInputError(
          `Insufficient Balance of ${pool?.aTokenSymbol} or ${pool?.bTokenSymbol}`,
        )
      } else if (
        aTokenAllowance.lt(aTokenAmount) ||
        bTokenAllowance.lt(bTokenAmount)
      ) {
        setInputError('Please unlock token to continue.')
        if (aTokenAllowance.lt(aTokenAmount)) {
          setShowATokenUnlock(true)
        }
        if (bTokenAllowance.lt(bTokenAmount)) {
          setShowBTokenUnlock(true)
        }
      } else {
        setInputError('')
        setShowATokenUnlock(false)
        setShowBTokenUnlock(false)
      }
      return () => {
        setInputError('')
        setShowATokenUnlock(false)
        setShowBTokenUnlock(false)
      }
    } else if (aTokenAmount && aTokenBalance && aTokenAllowance) {
      if (aTokenBalance.lt(aTokenAmount)) {
        setInputError(`Insufficient Balance of ${pool?.aTokenSymbol}`)
      } else if (aTokenAllowance.lt(aTokenAmount)) {
        setInputError('Please unlock token to continue.')
        if (aTokenAllowance.lt(aTokenAmount)) {
          setShowATokenUnlock(true)
        }
      } else {
        setInputError('')
        setShowATokenUnlock(false)
      }
      return () => {
        setInputError('')
        setShowATokenUnlock(false)
      }
    } else if (bTokenAmount && bTokenBalance && bTokenAllowance) {
      if (bTokenBalance.lt(bTokenAmount)) {
        setInputError(`Insufficient Balance of ${pool?.bTokenSymbol}`)
      } else if (bTokenAllowance.lt(bTokenAmount)) {
        setInputError('Please unlock token to continue.')
        if (bTokenAllowance.lt(bTokenAmount)) {
          setShowBTokenUnlock(true)
        }
      } else {
        setInputError('')
        setShowBTokenUnlock(false)
      }
      return () => {
        setInputError('')
        setShowBTokenUnlock(false)
      }
    }
  }, [
    aTokenAllowance,
    aTokenAmount,
    aTokenBalance,
    bTokenAllowance,
    bTokenAmount,
    bTokenBalance,
    pool,
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

      if (account && poolAddress && pool && token) {
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
      poolAddress,
      pool,
      aTokenBalance,
      bTokenBalance,
      addTransaction,
    ],
  )

  // Add Liquidity
  const exchangeContract = useExchangeContract(poolAddress)
  const [isPending, setIsPending] = useState(false)
  const onDeposit = useCallback(async () => {
    if (exchangeContract && amountParsed && aTokenReserve && bTokenReserve) {
      try {
        const estimatedGas = await exchangeContract.estimateGas.addLiquidity(
          amountParsed,
          aTokenAmountMaximum,
          bTokenAmountMaximum,
        )
        const tx = await exchangeContract.addLiquidity(
          amountParsed,
          aTokenAmountMaximum,
          bTokenAmountMaximum,
          {
            gasLimit: calculateGasMargin(estimatedGas, GAS_MARGIN),
          },
        )
        setIsPending(true)
        addTransaction(tx)
        await tx.wait()
        setIsOpen(false)
      } finally {
        setIsPending(false)
      }
    }
  }, [
    exchangeContract,
    amountParsed,
    aTokenReserve,
    bTokenReserve,
    aTokenAmountMaximum,
    bTokenAmountMaximum,
    addTransaction,
  ])

  // Add Liquidity imblance
  const onDepositCustom = useCallback(async () => {
    if (
      exchangeContract &&
      customTokenAAmountParsed &&
      customTokenBAmountParsed &&
      shareTokenAmountMinimum &&
      aTokenReserve &&
      bTokenReserve
    ) {
      try {
        const estimatedGas = await exchangeContract.estimateGas.addLiquidityImbalanced(
          customTokenAAmountParsed,
          customTokenBAmountParsed,
          shareTokenAmountMinimum,
        )
        const tx = await exchangeContract.addLiquidityImbalanced(
          customTokenAAmountParsed,
          customTokenBAmountParsed,
          shareTokenAmountMinimum,
          {
            gasLimit: calculateGasMargin(estimatedGas, GAS_MARGIN),
          },
        )
        setIsPending(true)
        addTransaction(tx)
        await tx.wait()
        setIsOpen(false)
      } finally {
        setIsPending(false)
      }
    }
  }, [
    exchangeContract,
    customTokenAAmountParsed,
    customTokenBAmountParsed,
    shareTokenAmountMinimum,
    aTokenReserve,
    bTokenReserve,
    addTransaction,
  ])

  const noAccountError = useMemo(
    () => (account ? '' : 'Wallet is not connected.'),
    [account],
  )

  const noAmountError = useMemo(
    () =>
      isCustomPage ? !(customTokenAAmount || customTokenBAmount) : !amount,
    [amount, customTokenAAmount, customTokenBAmount, isCustomPage],
  )

  const errorMessage = noAccountError || noAmountError || inputError

  const [isOpen, setIsOpen] = useState(false)
  const [isCheckin1, setIsCheckin1] = useState(false)
  const [isCheckin2, setIsCheckin2] = useState(false)
  const [isCheckin3, setIsCheckin3] = useState(false)
  const [isCheckin4, setIsCheckin4] = useState(false)
  const isAllCheckin = isCheckin1 && isCheckin2 && isCheckin3 && isCheckin4
  useEffect(() => {
    if (isOpen === false) {
      setIsCheckin1(false)
      setIsCheckin2(false)
      setIsCheckin3(false)
      setIsCheckin4(false)
    }
  }, [isOpen])

  return (
    <>
      <Card>
        <DepositSelector
          isCustomPage={isCustomPage}
          setIsCustomPage={setIsCustomPage}
        />

        {isCustomPage ? (
          <div>
            <UnlockWrapper>
              <CoinWrapper>
                <CoinIcon
                  src={(TokenSymbolImage as any)[pool?.aTokenSymbol]}
                  alt='icon coin'
                />
                <CoinText>{pool?.aTokenSymbol}</CoinText>
              </CoinWrapper>
              {showATokenUnlock && (
                <UnlockButton
                  disabled={isApprovingTokens[pool?.aTokenAddress]}
                  onClick={() => approve(pool?.aTokenAddress)}
                >
                  {isApprovingTokens[pool?.aTokenAddress]
                    ? 'Pending'
                    : `Unlock ${pool?.aTokenSymbol}`}
                </UnlockButton>
              )}
            </UnlockWrapper>
            <CoinInputPanel
              title=''
              selectedCoin={pool.aTokenAddress}
              value={customTokenAAmount}
              onValueChange={(value) => setCustomTokenAAmount(value)}
            />
            <StyledPlusIcon />

            <div>
              <UnlockWrapper>
                <CoinWrapper>
                  <CoinIcon
                    src={(TokenSymbolImage as any)[pool?.bTokenSymbol]}
                    alt='icon coin'
                  />
                  <CoinText>{pool?.bTokenSymbol}</CoinText>
                </CoinWrapper>
                {showBTokenUnlock && (
                  <UnlockButton
                    disabled={isApprovingTokens[pool?.bTokenAddress]}
                    onClick={() => approve(pool?.bTokenAddress)}
                  >
                    {isApprovingTokens[pool?.bTokenAddress]
                      ? 'Pending...'
                      : `Unlock ${pool?.bTokenSymbol}`}
                  </UnlockButton>
                )}
              </UnlockWrapper>
              <CoinInputPanel
                title=''
                selectedCoin={pool.bTokenAddress}
                value={customTokenBAmount}
                onValueChange={(value) => setCustomTokenBAmount(value)}
              />
            </div>
            <StyledArrowDownIcon />
            <GetShareLabel> Get Share </GetShareLabel>
            <GetShareAmount>{shareTokenAmountFormatted}</GetShareAmount>
          </div>
        ) : (
          <div>
            <CoinInputPanel
              title='How many positions do you deposit?'
              selectedCoin={poolAddress}
              value={amount}
              onValueChange={(value) => setAmount(value)}
              showMax={false}
              showBalance={false}
              renderCoinButtons={() => (
                <>
                  {showATokenUnlock && (
                    <UnlockButton
                      disabled={isApprovingTokens[pool?.aTokenAddress]}
                      onClick={() => approve(pool?.aTokenAddress)}
                    >
                      {isApprovingTokens[pool?.aTokenAddress]
                        ? 'Pending'
                        : `Unlock ${pool?.aTokenSymbol}`}
                    </UnlockButton>
                  )}
                  {showBTokenUnlock && (
                    <UnlockButton
                      disabled={isApprovingTokens[pool?.bTokenAddress]}
                      onClick={() => approve(pool?.bTokenAddress)}
                    >
                      {isApprovingTokens[pool?.bTokenAddress]
                        ? 'Pending...'
                        : `Unlock ${pool?.bTokenSymbol}`}
                    </UnlockButton>
                  )}
                </>
              )}
            />
            <StyledArrowDownIcon />
            <div>
              <Row>
                <CoinWrapper>
                  <CoinIcon
                    src={(TokenSymbolImage as any)[pool?.aTokenSymbol]}
                    alt='icon coin'
                  />
                  <CoinText>{pool?.aTokenSymbol}</CoinText>
                </CoinWrapper>
                <Number>{aTokenAmountFormatted}</Number>
              </Row>
              <Row>
                <CoinWrapper>
                  <CoinIcon
                    src={(TokenSymbolImage as any)[pool?.bTokenSymbol]}
                    alt='icon coin'
                  />
                  <CoinText>{pool?.bTokenSymbol}</CoinText>
                </CoinWrapper>
                <Number>{bTokenAmountFormatted}</Number>
              </Row>
            </div>
          </div>
        )}
        <SummaryMessage>{summaryMessage}</SummaryMessage>
        <ButtonWrapper>
          <Button
            disabled={!!errorMessage || isPending}
            onClick={() => {
              if (isCustomPage) {
                if (
                  (customTokenAAmountParsed &&
                    !customTokenAAmountParsed.isZero()) ||
                  (customTokenBAmountParsed &&
                    !customTokenBAmountParsed.isZero())
                ) {
                  setIsOpen(true)
                }
              } else {
                if (amountParsed && !amountParsed.isZero()) {
                  setIsOpen(true)
                }
              }
            }}
          >
            {isPending ? 'Pending...' : 'deposit'}
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
        bhsBalance={bhsBalance}
        aTokenReserve={aTokenReserve}
        bTokenReserve={bTokenReserve}
        amplifier={A}
        totalSupply={totalSupply}
      />
      <Dialog isOpen={isOpen} onDismiss={() => setIsOpen(false)}>
        <DialogContent>
          <CautionIcon />
          <DialogTitle>{summaryMessage}</DialogTitle>
          <DialogSubTitle>Check Caution Terms</DialogSubTitle>
          <CheckboxWrapper>
            <Checkbox
              label='I understand that BlackHoleSwap is risky and highly experimental tech.'
              checked={isCheckin1}
              onChange={() => setIsCheckin1(!isCheckin1)}
            />
          </CheckboxWrapper>
          <CheckboxWrapper>
            <Checkbox
              label='I understand that the contract has not audited. Some bugs might exist.'
              checked={isCheckin2}
              onChange={() => setIsCheckin2(!isCheckin2)}
            />
          </CheckboxWrapper>
          <CheckboxWrapper>
            <Checkbox
              label='I understand that it is potential to lose all money if I deposit them.'
              checked={isCheckin3}
              onChange={() => setIsCheckin3(!isCheckin3)}
            />
          </CheckboxWrapper>
          <CheckboxWrapper>
            <Checkbox
              label='I understand that I cannot get compensations ABSOLUTELY if I lose money.'
              checked={isCheckin4}
              onChange={() => setIsCheckin4(!isCheckin4)}
            />
          </CheckboxWrapper>
          <ButtonWrapper>
            <Button
              disabled={!isAllCheckin || isPending}
              onClick={isCustomPage ? onDepositCustom : onDeposit}
            >
              {isPending ? 'Pending...' : 'confirm'}
            </Button>
          </ButtonWrapper>
        </DialogContent>
      </Dialog>
    </>
  )
}
