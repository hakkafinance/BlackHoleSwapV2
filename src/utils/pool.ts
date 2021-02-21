import { Web3Provider } from '@ethersproject/providers'
import { Zero, One, WeiPerEther } from '@ethersproject/constants'
import { BigNumber } from '@ethersproject/bignumber'
import { parseUnits } from '@ethersproject/units'
import { getContract } from './index'
import { BLOCKS_PER_DAY, DAYS_PER_YEAR } from '../constants'
import CTOKEN_ABI from '../constants/abis/ctoken.json'
import COMPTROLLER_ABI from '../constants/abis/comptroller.json'
import ORACLE_ABI from '../constants/abis/oracle.json'
import WHITEHOLESWAP_ABI from '../constants/abis/WhiteHoleSwap.json'

export async function getToken0Balance(
  whiteholeswapAddress: string,
  library: Web3Provider,
): Promise<BigNumber> {
  const whiteholeswap = getContract(
    whiteholeswapAddress,
    WHITEHOLESWAP_ABI,
    library,
  )
  const balance = await whiteholeswap.getToken0Balance()
  return balance
}

export async function getToken1Balance(
  whiteholeswapAddress: string,
  library: Web3Provider,
): Promise<BigNumber> {
  const whiteholeswap = getContract(
    whiteholeswapAddress,
    WHITEHOLESWAP_ABI,
    library,
  )
  const balance = await whiteholeswap.getToken1Balance()
  return balance
}

export async function getCashOnCompound(
  cTokenAddress: string,
  library: Web3Provider,
): Promise<BigNumber> {
  const cToken = getContract(cTokenAddress, CTOKEN_ABI, library)
  const cash = await cToken.getCash()
  return cash
}

export async function getAPYsOnCompound(
  cTokenAddress: string,
  library: Web3Provider,
) {
  const cToken = getContract(cTokenAddress, CTOKEN_ABI, library)
  const [supplyRatePerBlock, borrowRatePerBlock] = await Promise.all([
    cToken.supplyRatePerBlock(),
    cToken.borrowRatePerBlock(),
  ])

  const supplyAPY = calculateAPY(supplyRatePerBlock)
  const borrowAPY = calculateAPY(borrowRatePerBlock)

  return { supplyAPY, borrowAPY }
}

export async function getRewardsAPYsOnCompound(
  cTokenAddress: string,
  comptrollerAddress: string,
  oracleAddress: string,
  tokenDecimals: number,
  library: Web3Provider,
) {
  const cToken = getContract(cTokenAddress, CTOKEN_ABI, library)
  const comptroller = getContract(comptrollerAddress, COMPTROLLER_ABI, library)
  const oracle = getContract(oracleAddress, ORACLE_ABI, library)
  const [cash, borrow, compSpeeds, compPrice] = await Promise.all([
    cToken.getCash(),
    cToken.totalBorrowsCurrent(),
    comptroller.compSpeeds(cTokenAddress),
    oracle.price('COMP'),
  ])

  const supplyAPY = calculateCompAPY(
    cash.add(borrow),
    tokenDecimals,
    compSpeeds,
    compPrice,
  )
  const borrowAPY = calculateCompAPY(
    borrow,
    tokenDecimals,
    compSpeeds,
    compPrice,
  )

  return { supplyAPY, borrowAPY }
}

// Helper functions

function calculateAPY(ratePerBlock: BigNumber): BigNumber {
  const dayRange = DAYS_PER_YEAR.sub(One)
  return ratePerBlock
    .mul(BLOCKS_PER_DAY)
    .add(WeiPerEther)
    .pow(dayRange)
    .div(WeiPerEther.pow(dayRange.sub(One)))
    .sub(WeiPerEther)
}

function calculateCompAPY(
  reserve: BigNumber,
  tokenDecimals: number,
  compSpeed: BigNumber,
  compPrice: BigNumber,
): BigNumber {
  const nominator = compSpeed
    .mul(BLOCKS_PER_DAY)
    .mul(DAYS_PER_YEAR)
    .mul(compPrice)
    .div(parseUnits('10', 6))
  const denominator = reserve
    .mul(WeiPerEther)
    .div(parseUnits('10', tokenDecimals))
  return denominator.isZero()
    ? Zero
    : nominator.mul(WeiPerEther).div(denominator)
}
