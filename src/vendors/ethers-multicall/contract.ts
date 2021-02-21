import { JsonFragment } from '@ethersproject/abi'

export class Contract {
  private _address: string
  private _abi: JsonFragment[]
  private _functions: JsonFragment[]

  get address() {
    return this._address
  }

  get abi() {
    return this._abi
  }

  get functions() {
    return this._functions
  }

  constructor(address: string, abi: JsonFragment[]) {
    this._address = address
    this._abi = abi

    this._functions = abi.filter(x => x.type === 'function')
    const callFunctions = this._functions

    for (const callFunction of callFunctions) {
      const { name } = callFunction
      const getCall = makeCallFunction(this, name as string)
      if (!(this as any)[name as string]) {
        defineReadOnly(this, name as string, getCall)
      }
    }
  }
}

function makeCallFunction(contract: Contract, name: string) {
  return (...params: any[]) => {
    const { address } = contract
    const { inputs } = contract.functions.find(f => f.name === name) as JsonFragment
    const { outputs } = contract.functions.find(f => f.name === name) as JsonFragment
    return {
      contract: {
        address,
      },
      name,
      inputs,
      outputs,
      params,
    }
  }
}

function defineReadOnly(object: {}, name: string, value: any) {
  Object.defineProperty(object, name, {
    enumerable: true,
    value,
    writable: false,
  })
}
