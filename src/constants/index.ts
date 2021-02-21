import { BigNumber } from '@ethersproject/bignumber'
import { parseUnits } from '@ethersproject/units'
import { Addresses, Pools } from '../utils/types'
import { getToken0Balance, getToken1Balance } from '../utils/pool'
import DAI_IMAGE from '../assets/dai.png'
import SUSD_IMAGE from '../assets/susd.png'
import BUSD_IMAGE from '../assets/busd.png'
import USDT_IMAGE from '../assets/usdt.png'

export const TokenSymbolImage = {
  DAI: DAI_IMAGE,
  sUSD: SUSD_IMAGE,
  BUSD: BUSD_IMAGE,
  USDT: USDT_IMAGE,
}

export const BASE = parseUnits('1', 18)

export const POOLS: Pools = {
  1: {
    '0x35101c731b1548B5e48bb23F99eDBc2f5c341935': {
      address: '0x35101c731b1548B5e48bb23F99eDBc2f5c341935',
      aTokenAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      aTokenSymbol: 'DAI',
      aTokenDecimals: 18,
      bTokenAddress: '0x57Ab1ec28D129707052df4dF418D58a2D46d5f51',
      bTokenSymbol: 'sUSD',
      bTokenDecimals: 18,
      getATokenCash: (library) =>
        getToken0Balance('0x35101c731b1548B5e48bb23F99eDBc2f5c341935', library),
      getBTokenCash: (library) =>
        getToken1Balance('0x35101c731b1548B5e48bb23F99eDBc2f5c341935', library),
    },
  },
  42: {
    '0xe5d7B5b141bB9621d9D5665018339fE92FBDD528': {
      address: '0xe5d7B5b141bB9621d9D5665018339fE92FBDD528',
      aTokenAddress: '0x8F69BD7078681f889f6D8bad4227B3B0A3F2d9B0',
      aTokenSymbol: 'USDT',
      aTokenDecimals: 18,
      bTokenAddress: '0x9cbB6d11C08840fdc8744d0DFD353615EfC13B03',
      bTokenSymbol: 'BUSD',
      bTokenDecimals: 18,
      getATokenCash: (library) =>
        getToken0Balance('0xe5d7B5b141bB9621d9D5665018339fE92FBDD528', library),
      getBTokenCash: (library) =>
        getToken1Balance('0xe5d7B5b141bB9621d9D5665018339fE92FBDD528', library),
    },
  },
  56: {
    '0x75192d6f3d51554cc2ee7b40c3aac5f97934ce7e': {
      address: '0x75192d6f3d51554cc2ee7b40c3aac5f97934ce7e',
      aTokenAddress: '0x55d398326f99059fF775485246999027B3197955',
      aTokenSymbol: 'USDT',
      aTokenDecimals: 18,
      bTokenAddress: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
      bTokenSymbol: 'BUSD',
      bTokenDecimals: 18,
      getATokenCash: (library) =>
        getToken0Balance('0x75192d6f3d51554cc2ee7b40c3aac5f97934ce7e', library),
      getBTokenCash: (library) =>
        getToken1Balance('0x75192d6f3d51554cc2ee7b40c3aac5f97934ce7e', library),
    },
  },
  97: {
    '0x2400e8BBc96da80D723160dDdcCA11D9C4dcd7b9': {
      address: '0x2400e8BBc96da80D723160dDdcCA11D9C4dcd7b9',
      aTokenAddress: '0xc56ef1d07540ED20cBFE7e13A07ede4cd81fF72d',
      aTokenSymbol: 'DAI',
      aTokenDecimals: 18,
      bTokenAddress: '0x8C12B647eC2d56426461c70D2E4F0477f8eEA032',
      bTokenSymbol: 'sUSD',
      bTokenDecimals: 18,
      getATokenCash: (library) =>
        getToken0Balance('0x2400e8BBc96da80D723160dDdcCA11D9C4dcd7b9', library),
      getBTokenCash: (library) =>
        getToken1Balance('0x2400e8BBc96da80D723160dDdcCA11D9C4dcd7b9', library),
    },
  },
}

export const EXCHANGE_ADDRESSES: Addresses = {
  // 1: '0x11bafFebd829B490Cf077Ce7eF7700dd3cB1e534', // alpha
  1: '0x35101c731b1548B5e48bb23F99eDBc2f5c341935', // beta
  42: '0xe5d7B5b141bB9621d9D5665018339fE92FBDD528',
  56: '0x75192d6f3d51554cc2ee7b40c3aac5f97934ce7e', // BSC Mainnet
  97: '0x2400e8BBc96da80D723160dDdcCA11D9C4dcd7b9', // BSC testnet
}

export const GAS_MARGIN = BigNumber.from(1000)

export const BLOCKS_PER_DAY = BigNumber.from(4 * 60 * 24)
export const DAYS_PER_YEAR = BigNumber.from(365)

export const NetworkContextName = 'NetworkContextName'
