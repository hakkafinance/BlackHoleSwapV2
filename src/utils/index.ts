import { Contract } from '@ethersproject/contracts'
import { getAddress } from '@ethersproject/address'
import { AddressZero } from '@ethersproject/constants'
import { parseBytes32String } from '@ethersproject/strings'
import { formatUnits } from '@ethersproject/units'
import { JsonRpcSigner, Web3Provider } from '@ethersproject/providers'
import { FixedNumber, BigNumber } from '@ethersproject/bignumber'
import { ChainId, ErrorCodes, TokenError } from './types'
import ERC20_ABI from '../constants/abis/erc20.json'
import ERC20_BYTES32_ABI from '../constants/abis/erc20_bytes32.json'

export function safeAccess(object: any, path: Array<string | number>) {
  return object
    ? path.reduce(
        (accumulator: any, currentValue: string | number) =>
          accumulator && accumulator[currentValue]
            ? accumulator[currentValue]
            : null,
        object,
      )
    : null
}

export function isAddress(value: any): string | false {
  try {
    return getAddress(value)
  } catch {
    return false
  }
}

export function shortenAddress(address: string, digits: number = 4): string {
  if (!isAddress(address)) {
    throw Error(`Invalid 'address' parameter '${address}'.`)
  }
  return `${address.substring(0, digits + 2)}...${address.substring(
    42 - digits,
  )}`
}

export function shortenTransactionHash(
  hash: string,
  digits: number = 6,
): string {
  return `${hash.substring(0, digits + 2)}...${hash.substring(66 - digits)}`
}

export function getNetworkName(chainId: number): string {
  switch (chainId) {
    case 1: {
      return 'Main Network'
    }
    case 3: {
      return 'Ropsten'
    }
    case 4: {
      return 'Rinkeby'
    }
    case 5: {
      return 'Görli'
    }
    case 42: {
      return 'Kovan'
    }
    case 56: {
      return 'BSC Mainnet'
    }
    case 97: {
      return 'BSC Testnet'
    }
    default: {
      return 'correct network'
    }
  }
}

const ETHERSCAN_PREFIXES: { [chainId: number]: string } = {
  1: '',
  3: 'ropsten.',
  4: 'rinkeby.',
  5: 'goerli.',
  42: 'kovan.',
  56: '', // BSC mainnet
  97: 'testnet.', // BSC testnet
}

export function getEtherscanLink(
  chainId: ChainId,
  data: string,
  type: 'transaction' | 'address',
): string {
  const prefix =
    chainId === 56 || chainId === 97
      ? `https://${
          ETHERSCAN_PREFIXES[chainId] || ETHERSCAN_PREFIXES[1]
        }bscscan.com`
      : `https://${
          ETHERSCAN_PREFIXES[chainId] || ETHERSCAN_PREFIXES[1]
        }etherscan.io`

  switch (type) {
    case 'transaction': {
      return `${prefix}/tx/${data}`
    }
    case 'address':
    default: {
      return `${prefix}/address/${data}`
    }
  }
}

export async function getGasPrice(level: string): Promise<BigNumber> {
  const response = await fetch('https://ethgasstation.info/json/ethgasAPI.json')
  const data = await response.json()
  const gasPrice = BigNumber.from(data[level].toString()).div(10).mul(1e9) // convert unit to wei
  return gasPrice
}

export function calculateGasMargin(value: BigNumber, margin: BigNumber) {
  const offset = value.mul(margin).div(BigNumber.from(10000))
  return value.add(offset)
}

// get the ether balance of an address
export async function getEtherBalance(address: string, library: Web3Provider) {
  if (!isAddress(address)) {
    throw Error(`Invalid 'address' parameter '${address}'`)
  }
  return library.getBalance(address)
}

// account is not optional
export function getSigner(
  library: Web3Provider,
  account: string,
): JsonRpcSigner {
  return library.getSigner(account).connectUnchecked()
}

// account is optional
export function getProviderOrSigner(
  library: Web3Provider,
  account?: string,
): Web3Provider | JsonRpcSigner {
  return account ? getSigner(library, account) : library
}

// account is optional
export function getContract(
  address: string,
  ABI: any,
  library: Web3Provider,
  account?: string,
): Contract {
  if (!isAddress(address) || address === AddressZero) {
    throw Error(`Invalid 'address' parameter '${address}'.`)
  }

  return new Contract(
    address,
    ABI,
    getProviderOrSigner(library, account) as any,
  )
}

// get token name
export async function getTokenName(
  tokenAddress: string,
  library: Web3Provider,
): Promise<string> {
  if (!isAddress(tokenAddress)) {
    throw Error(`Invalid 'tokenAddress' parameter '${tokenAddress}'.`)
  }

  return getContract(tokenAddress, ERC20_ABI, library)
    .name()
    .catch(() =>
      getContract(tokenAddress, ERC20_BYTES32_ABI, library)
        .name()
        .then((bytes32: string) => parseBytes32String(bytes32)),
    )
    .catch((error: TokenError) => {
      error.code = ErrorCodes.TOKEN_SYMBOL
      throw error
    })
}

// get token symbol
export async function getTokenSymbol(
  tokenAddress: string,
  library: Web3Provider,
): Promise<string> {
  if (!isAddress(tokenAddress)) {
    throw Error(`Invalid 'tokenAddress' parameter '${tokenAddress}'.`)
  }

  return getContract(tokenAddress, ERC20_ABI, library)
    .symbol()
    .catch(() => {
      const contractBytes32 = getContract(
        tokenAddress,
        ERC20_BYTES32_ABI,
        library,
      )
      return contractBytes32
        .symbol()
        .then((bytes32: string) => parseBytes32String(bytes32))
    })
    .catch((error: TokenError) => {
      error.code = ErrorCodes.TOKEN_SYMBOL
      throw error
    })
}

/// get token decimals
export async function getTokenDecimals(
  tokenAddress: string,
  library: Web3Provider,
): Promise<BigNumber> {
  if (!isAddress(tokenAddress)) {
    throw Error(`Invalid 'tokenAddress' parameter '${tokenAddress}'.`)
  }

  return getContract(tokenAddress, ERC20_ABI, library)
    .decimals()
    .catch((error: TokenError) => {
      error.code = ErrorCodes.TOKEN_DECIMALS
      throw error
    })
}

// get the token balance of an address
export async function getTokenBalance(
  tokenAddress: string,
  address: string,
  library: Web3Provider,
): Promise<BigNumber> {
  if (!isAddress(tokenAddress) || !isAddress(address)) {
    throw Error(
      `Invalid 'tokenAddress' or 'address' parameter '${tokenAddress}' or '${address}'.`,
    )
  }

  return getContract(tokenAddress, ERC20_ABI, library).balanceOf(address)
}

// get the token allowance
export async function getTokenAllowance(
  address: string,
  tokenAddress: string,
  spenderAddress: string,
  library: Web3Provider,
): Promise<BigNumber> {
  if (
    !isAddress(address) ||
    !isAddress(tokenAddress) ||
    !isAddress(spenderAddress)
  ) {
    throw Error(
      "Invalid 'address' or 'tokenAddress' or 'spenderAddress' parameter" +
        `'${address}' or '${tokenAddress}' or '${spenderAddress}'.`,
    )
  }

  return getContract(tokenAddress, ERC20_ABI, library).allowance(
    address,
    spenderAddress,
  )
}

export function amountFormatter(
  amount: BigNumber,
  baseDecimals: number,
  displayDecimals: number = 4,
): string {
  if (
    baseDecimals > 18 ||
    displayDecimals > 18 ||
    displayDecimals > baseDecimals
  ) {
    throw Error(
      `Invalid combination of baseDecimals '${baseDecimals}' and displayDecimals '${displayDecimals}.`,
    )
  }

  if (amount.isZero()) {
    return '0'
  }

  const amountDecimals = baseDecimals - amount.toString().length + 1

  return FixedNumber.from(formatUnits(amount, baseDecimals))
    .round(
      amountDecimals >= displayDecimals ? amountDecimals + 1 : displayDecimals,
    )
    .toString()
}

export function percentageFormatter(
  amount: BigNumber,
  baseDecimals: number,
  displayDecimals: number = 2,
): string {
  if (
    baseDecimals > 18 ||
    displayDecimals > 18 ||
    displayDecimals > baseDecimals
  ) {
    throw Error(
      `Invalid combination of baseDecimals '${baseDecimals}' and displayDecimals '${displayDecimals}.`,
    )
  }

  if (amount.isZero()) {
    return '0'
  }

  return `${(parseFloat(formatUnits(amount, baseDecimals)) * 100).toFixed(
    displayDecimals,
  )} %`
}
