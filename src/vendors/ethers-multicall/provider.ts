import { Web3Provider } from '@ethersproject/providers'
import { all, Call } from './call'
import { getEthBalance } from './calls'

export type ChainId = 1 | 4 | 42 | 100 | 1337

export class Provider {
  private _provider: Web3Provider
  private _multicallAddress: string

  constructor(provider: Web3Provider, chainId: number) {
    this._provider = provider
    this._multicallAddress = getAddressForChainId(chainId)
  }

  async init() {
    // Only required if `chainId` was not provided in constructor
    this._multicallAddress = await getAddress(this._provider)
  }

  getEthBalance(address: string) {
    if (!this._provider) {
      throw new Error('Provider should be initialized before use.')
    }
    return getEthBalance(address, this._multicallAddress)
  }

  async all(calls: Call[]) {
    if (!this._provider) {
      throw new Error('Provider should be initialized before use.')
    }
    return all(calls, this._multicallAddress, this._provider)
  }
}

function getAddressForChainId(chainId: number) {
  const addresses = {
    1: '0xeefba1e63905ef1d7acba5a8513c70307c1ce441',
    4: '0x42ad527de7d4e9d9d011ac45b31d8551f8fe9821',
    42: '0x2cc8688c5f75e365aaeeb4ea8d6a480405a48d2a',
    100: '0xb5b692a88bdfc81ca69dcb1d924f59f0413a602a',
    1337: '0x77dca2c955b15e9de4dbbcf1246b4b85b651e50e',
    56: '0x1ee38d535d541c55c9dae27b12edf090c608e6fb',
    97: '0x75113592cFaEA05ba89bB56fD3D8328AD797E570',
  }
  return (addresses as any)[chainId]
}

async function getAddress(provider: Web3Provider) {
  const { chainId } = await provider.getNetwork()
  return getAddressForChainId(chainId)
}
