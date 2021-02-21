import { Zero, MaxUint256, WeiPerEther } from '@ethersproject/constants'
import { BigNumber } from '@ethersproject/bignumber'
import { parseUnits } from '@ethersproject/units'

export function calculateSlippageBounds(
  value: BigNumber,
  allowedSlippage: BigNumber
): { minimum: BigNumber | undefined, maximum: BigNumber | undefined } {
  if (!value) {
    return {
      minimum: undefined,
      maximum: undefined,
    }
  }

  const abs = value.abs()
  const offset = abs.mul(allowedSlippage).div(BigNumber.from('10000'))
  const minimum = abs.sub(offset)
  const maximum = abs.add(offset)
  return {
    minimum: minimum.lt(Zero)
      ? Zero
      : minimum,
    maximum: maximum.gt(MaxUint256)
      ? MaxUint256
      : maximum,
  }
}

export function calculateExchangeRate(
  inputValue: BigNumber,
  inputDecimals: number,
  outputValue: BigNumber,
  outputDecimals: number,
): BigNumber | undefined {
  if (
    inputValue &&
    (inputDecimals || inputDecimals === 0) &&
    outputValue &&
    (outputDecimals || outputDecimals === 0)
  ) {
    return outputValue
      .mul(WeiPerEther)
      .div(inputValue)
      .mul(parseUnits('1', inputDecimals))
      .div(parseUnits('1', outputDecimals))
  }
}
