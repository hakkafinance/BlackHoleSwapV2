import React from 'react'
import styled from 'styled-components'

const Selector = styled.div`
  width: 100%;
  height: 30px;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 25px;
`

const Button = styled.button.attrs({ type: 'button' })<{
  isCustomPage: boolean
}>`
  width: 50%;
  height: 100%;
  padding: 0;
  border: 1px solid
    ${({ isCustomPage, theme }) => (isCustomPage ? '#DB5F00' : 'transparent')};

  background-color: ${({ isCustomPage, theme }) =>
    isCustomPage ? theme.colors.orange : theme.colors.gray500};

  border-top-color: ${({ theme, isCustomPage }) =>
    isCustomPage ? theme.colors.gray500 : theme.colors.blue700};
  border-right-color: ${({ theme, isCustomPage }) =>
    isCustomPage ? theme.colors.gray300 : theme.colors.blue700};
  border-bottom-color: ${({ theme, isCustomPage }) =>
    isCustomPage ? theme.colors.gray500 : theme.colors.blue500};
  border-left-color: ${({ theme, isCustomPage }) =>
    isCustomPage ? theme.colors.black : theme.colors.gray500};

  color: ${({ isCustomPage, theme }) =>
    isCustomPage ? theme.colors.black : theme.colors.gray300};
  font-size: 15px;
  font-weight: 700;
  text-transform: uppercase;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;

  &:focus {
    outline: none;
  }
`

type DepositSelectorProps = {
  isCustomPage?: any
  setIsCustomPage?: any
}

export default function DepositSelector(props: DepositSelectorProps) {
  const { isCustomPage, setIsCustomPage } = props

  return (
    <Selector>
      <Button
        isCustomPage={!isCustomPage}
        onClick={() => setIsCustomPage(false)}
      >
        Fixed
      </Button>
      <Button isCustomPage={isCustomPage} onClick={() => setIsCustomPage(true)}>
        Custom
      </Button>
    </Selector>
  )
}
