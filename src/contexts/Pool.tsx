import React, {
  createContext,
  useContext,
  useState,
} from 'react'

const PoolContext = createContext<any[]>([])

export function usePoolContext() {
  return useContext(PoolContext)
}

export default function Provider({ children }: { children: React.ReactNode }) {
  const [poolAddress, setPoolAddress] = useState()

  return (
    <PoolContext.Provider value={[poolAddress, setPoolAddress]}>{children}</PoolContext.Provider>
  )
}
