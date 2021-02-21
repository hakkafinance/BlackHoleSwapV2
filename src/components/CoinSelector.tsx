import React from 'react'
import styled, { DefaultTheme } from 'styled-components'

const CoinGroup = styled.div`
  display: flex;
`

const CoinButton = styled.button.attrs({ type: 'button' })`
  width: 64px;
  height: 32px;
  padding: 0;
  border: 1px solid;
  border-top-color: ${({
    theme,
    active,
  }: {
    theme: DefaultTheme
    active: boolean
  }) => (active ? theme.colors.gray500 : theme.colors.blue700)};

  border-right-color: ${({ theme, active }) =>
    active ? theme.colors.gray500 : theme.colors.blue500};
  border-bottom-color: ${({ theme, active }) =>
    active ? theme.colors.gray500 : theme.colors.blue500};

  background-color: ${({ theme, active }) =>
    active ? theme.colors.orange : theme.colors.gray500};
  color: ${({ theme, active }) =>
    active ? theme.colors.black : theme.colors.gray300};
  font-size: 15px;
  font-weight: 700;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;

  &:focus {
    outline: none;
  }

  &:first-of-type {
    border-left-color: ${({ theme, active }) =>
      active ? theme.colors.blue500 : theme.colors.gray500};
    border-right: none;
  }
`

export type SelectorOption = {
  value: string
  text: string
}

type CoinSelectorProps = {
  items: SelectorOption[]
  value: string
  onChange: (coin: string) => void
}

export default function CoinSelector(props: CoinSelectorProps): JSX.Element {
  const { items = [], value, onChange = () => {} } = props

  return (
    <CoinGroup>
      {items.map((item) => (
        <CoinButton
          key={item.value}
          active={value === item.value}
          onClick={() => onChange(item.value)}
        >
          {item.text}
        </CoinButton>
      ))}
    </CoinGroup>
  )
}
