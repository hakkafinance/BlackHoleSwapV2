import React, { useMemo } from 'react'
import styled from 'styled-components'
import { Zero, WeiPerEther } from '@ethersproject/constants'
import { BigNumber } from '@ethersproject/bignumber'
import { amountFormatter } from '../utils'
import { BASE } from '../constants'

const Card = styled.div`
  margin-top: 24px;
  padding: 32px 40px;
  border: 4px solid ${({ theme }) => theme.colors.gray500};
  background-color: ${({ theme }) => theme.colors.black};
`

const Article = styled.article`
  &:not(:first-child) {
    margin-top: 12px;
  }
`

const Title = styled.div`
  margin-bottom: 8px;
  color: ${({ theme }) => theme.colors.white};
  font-size: 18px;
  font-weight: 500;
`

const Text = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.white};
  font-size: 14px;
  font-weight: 500;
`

const Divider = styled.div`
  margin: 16px 0;
  width: 100%;
  height: 1px;
  background-color: ${({ theme }) => theme.colors.white};
`

type ReserveMatricsProps = {
  hasAccount?: boolean
  aTokenSymbol: string | undefined
  bTokenSymbol: string | undefined
  aTokenBalance: BigNumber | undefined
  bTokenBalance: BigNumber | undefined
  bhsBalance: BigNumber | undefined
  aTokenReserve: BigNumber | undefined
  bTokenReserve: BigNumber | undefined
  netAPY?: BigNumber | undefined
  rewardsAPY?: BigNumber | undefined
  rewardsSymbol?: string
  amplifier: BigNumber
  totalSupply: BigNumber | undefined
}

export default function ReserveMatrics(
  props: ReserveMatricsProps,
): JSX.Element {
  const {
    hasAccount = false,
    aTokenSymbol,
    bTokenSymbol,
    aTokenBalance,
    bTokenBalance,
    bhsBalance,
    aTokenReserve,
    bTokenReserve,
    amplifier,
    totalSupply,
  } = props

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

  const price = useMemo(() => {
    if (aTokenReserve && bTokenReserve && totalSupply) {
      if (totalSupply.isZero()) {
        return Zero
      }

      return BigNumber.from(2)
        .mul(sqrt(k(amplifier, aTokenReserve, bTokenReserve)))
        .mul(WeiPerEther)
        .div(WeiPerEther.add(amplifier))
        .mul(WeiPerEther)
        .div(totalSupply)
    }
  }, [aTokenReserve, totalSupply, bTokenReserve, amplifier])

  return (
    <Card>
      {hasAccount && (
        <>
          <Title>Your Portfolio</Title>
          <Article>
            <Text>
              {aTokenSymbol}:{' '}
              {aTokenBalance ? amountFormatter(aTokenBalance, 18) : '-'}
            </Text>
            <Text>
              {bTokenSymbol}:{' '}
              {bTokenBalance ? amountFormatter(bTokenBalance, 18) : '-'}
            </Text>
            <Text>
              Position: {bhsBalance ? amountFormatter(bhsBalance, 18) : '-'}
            </Text>
          </Article>
          <Divider />
        </>
      )}
      <Title>Currency Reserves</Title>
      <Article>
        <Text>
          {aTokenSymbol} :{' '}
          {aTokenReserve ? amountFormatter(aTokenReserve, 18) : '-'}
        </Text>
        <Text>
          {bTokenSymbol}:{' '}
          {bTokenReserve ? amountFormatter(bTokenReserve, 18) : '-'}
        </Text>
      </Article>
      <Article>
        <Text>Virtual Price: {price ? amountFormatter(price, 18) : '-'}</Text>
      </Article>
    </Card>
  )
}
