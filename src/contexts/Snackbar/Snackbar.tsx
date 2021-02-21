import React from 'react'
import styled from 'styled-components'

const SnackbarWrapper = styled.div`
  padding: 24px;
  border-top: 4px solid ${({ theme }) => theme.colors.blue500};
  background-color: ${({ theme }) => theme.colors.gray700};
  box-shadow: 0 0 60px ${({ theme }) => theme.colors.black};
`

const SnackbarMessage = styled.div`
  * {
    color: ${({ theme }) => theme.colors.white};
    font-size: 14px;
    font-weight: 500;
  }
`

type SnackbarProps = {
  children: React.ReactNode
}

export default function Snackbar(props: SnackbarProps): JSX.Element {
  const { children } = props

  return (
    <SnackbarWrapper>
      <SnackbarMessage>{children}</SnackbarMessage>
    </SnackbarWrapper>
  )
}
