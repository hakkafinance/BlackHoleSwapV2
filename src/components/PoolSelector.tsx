import React, { useMemo, useState, useEffect } from 'react'
import styled from 'styled-components'
import { useWeb3React } from '../hooks/ethereum'
import { usePoolContext } from '../contexts/Pool'
import { POOLS } from '../constants'
import { ChainId } from '../utils/types'
import { ReactComponent as DropdownIcon } from '../assets/dropdown.svg'
import { ReactComponent as DropupIcon } from '../assets/dropup.svg'
import CompoundImage from '../assets/compound.png'
import AaveImage from '../assets/aave.png'
import DforceImage from '../assets/dforce.png'

const ProtocolImage: { [protocol: string]: string } = {
  'Compound': CompoundImage,
  'AAVE': AaveImage,
  'Dforce': DforceImage,
}

const SelectorWrapper = styled.div`
  position: relative;
  width: 100%;
`

const Button = styled.button.attrs({ type: 'button' })`
  width: 100%;
  height: 55px;
  padding: 0 20px 0 40px;
  border: 0;
  background-color: ${({ theme }) => theme.colors.gray700};
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;

  &:focus {
    outline: none;
  }
`

const Row = styled.div`
  display: flex;
  align-items: center;
`

const Menu = styled.div`
  position: absolute;
  top: 55px;
  left: 0;
  z-index: 10;
  width: 100%;
  border-top: 1px solid ${({ theme }) => theme.colors.gray300};
  box-shadow: 0 0 60px 0 ${({ theme }) => theme.colors.black};
`

const Item = styled(Button)`
  background-color: ${({ theme }) => theme.colors.gray900};

  &:hover {
    background-color: ${({ theme }) => theme.colors.gray700};
  }
`

const Pairs = styled.span`
  color: ${({ theme }) => theme.colors.white};
  font-size: 18px;
  font-weight: 700;
`

const Protocol = styled.span`
  margin-left: 20px;
  color: ${({ theme }) => theme.colors.gray300};
  font-size: 14px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
`

const ProtocolLogo = styled.img`
  width: 20px;
  height: 20px;
  margin-right: 8px;
`

const Text = styled.span`
  margin-right: 16px;
  color: ${({ theme }) => theme.colors.white};
  font-size: 14px;
  font-weight: 500;
  display: inline-block;
`

export default function PoolSelector() {
  const { chainId } = useWeb3React()

  const pools = useMemo(() => POOLS[chainId as ChainId] || {}, [chainId])

  const [poolAddress, setPoolAddress] = usePoolContext()
  useEffect(() => {
    if (Object.keys(pools).length) {
      setPoolAddress(Object.keys(pools)[0])
    }
  }, [pools, setPoolAddress])

  const exchange = useMemo(() => pools[poolAddress], [poolAddress, pools])

  const [isOpen, setIsOpen] = useState(false)

  return (
    <SelectorWrapper>
      <Button onClick={() => setIsOpen(!isOpen)}>
        <Row>
          <Pairs>{exchange?.aTokenSymbol} - {exchange?.bTokenSymbol}</Pairs>
          <Protocol>
            <ProtocolLogo src={ProtocolImage[exchange?.protocol]} />
            {exchange?.protocol}
          </Protocol>
        </Row>
        <Row>
          <Text>Select Pool</Text>
          {isOpen ? <DropupIcon /> : <DropdownIcon />}
        </Row>
      </Button>
      {isOpen && (
        <Menu>
          {Object.keys(pools).map(address => (
            <Item
              key={address}
              onClick={() => {
                setPoolAddress(address)
                setIsOpen(false)
              }}
            >
              <div>
                <Pairs>{pools[address]?.aTokenSymbol} - {pools[address]?.bTokenSymbol}</Pairs>
                <Protocol>
                  <ProtocolLogo src={ProtocolImage[pools[address]?.protocol]} />
                  {pools[address]?.protocol}
                </Protocol>
              </div>
            </Item>
          ))}
        </Menu>
      )}
    </SelectorWrapper>
  )
}