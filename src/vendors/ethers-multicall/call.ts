import { Contract } from '@ethersproject/contracts'
import { Web3Provider } from '@ethersproject/providers'
import { ParamType } from '@ethersproject/abi'
import { Abi } from './abi'
import { multicallAbi } from './abi/multicall'

export interface Call {
  name: string
  contract: Contract
  params: ParamType[]
  inputs: ParamType[]
  outputs: ParamType[]
}

export async function all(calls: Call[], multicallAddress: string, provider: Web3Provider): Promise<any[]> {
  const multicall = new Contract(multicallAddress, multicallAbi, provider)
  const callRequests = calls.map(call => {
    const callData = Abi.encode(call.name, call.inputs, call.params)
    return [
      call.contract.address,
      callData,
    ]
  })
  const response = await multicall.aggregate(callRequests)
  const callCount = calls.length
  const callResult = []
  for (let i = 0; i < callCount; i++) {
    const outputs = calls[i].outputs
    const returnData = response.returnData[i]
    const params = Abi.decode(outputs, returnData)
    const result = outputs.length === 1 ? params[0] : params
    callResult.push(result)
  }
  return callResult
}
