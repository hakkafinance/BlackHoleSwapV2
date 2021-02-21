import React, { useMemo, useEffect } from 'react'
import styled from 'styled-components'
import Header from './Header'
import NavigationTabs from './NavigationTabs'
import WarningMessage from './WarningMessage'

import { useWeb3React } from '../hooks/ethereum'
import { POOLS } from '../constants'
import { ChainId } from '../utils/types'
import { usePoolContext } from '../contexts/Pool'

const Body = styled.div`
  max-width: 500px;
  margin: 0 auto;
  padding-bottom: 100px;
`

export default function Layout({
  children,
}: {
  children: React.ReactNode
}): JSX.Element {
  const { chainId } = useWeb3React()
  const pools = useMemo(() => POOLS[chainId as ChainId] || {}, [chainId])

  const [, setPoolAddress] = usePoolContext()
  useEffect(() => {
    if (Object.keys(pools).length) {
      setPoolAddress(Object.keys(pools)[0])
    }
  }, [pools, setPoolAddress])

  return (
    <>
      <Header />
      <Body>
        <WarningMessage />
        <NavigationTabs />
        {children}
      </Body>
    </>
  )
}
