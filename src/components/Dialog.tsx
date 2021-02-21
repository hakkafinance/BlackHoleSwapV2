import React from 'react'
import ReactDOM from 'react-dom'
import styled from 'styled-components'
import { transparentize } from 'polished'
import { useClickOutside } from '../hooks/dom'
import { ReactComponent as CloseIcon } from '../assets/close.svg'

const BackDrop = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  z-index: 30;
  width: 100vw;
  height: 100vh;
  background-color: ${({ theme }) => transparentize(0.8, theme.colors.white)};
  display: ${({ isOpen }: { isOpen: boolean }) => (isOpen ? 'flex' : 'none')};
  justify-content: center;
  align-items: center;
`

const Paper = styled.div`
  width: 90%;
  max-width: 440px;
  border-top: 4px solid ${({ theme }) => theme.colors.white};
  background-color: ${({ theme }) => theme.colors.gray700};
  box-shadow: 0 0 60px 0 ${({ theme }) => '#AAAAAA'};
`

const CloseButtonWrapper = styled.div`
  padding: 12px;
  display: flex;
  justify-content: flex-end;
`

const CloseButton = styled.button.attrs(() => ({ type: 'button' }))`
  padding: 0;
  border: 0;
  border-radius: 0.25rem;
  background-color: transparent;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
`

type DialogProps = {
  isOpen: boolean
  onDismiss: () => void
  children: React.ReactNode
}

export default function Dialog(props: DialogProps): JSX.Element {
  const { isOpen, onDismiss, children } = props
  const ref = useClickOutside(onDismiss, undefined)

  return ReactDOM.createPortal(
    <BackDrop isOpen={isOpen}>
      <Paper ref={ref}>
        <CloseButtonWrapper>
          <CloseButton onClick={onDismiss}>
            <CloseIcon />
          </CloseButton>
        </CloseButtonWrapper>
        <div>{children}</div>
      </Paper>
    </BackDrop>,
    document.body,
  )
}
