import React from 'react'
import {
  ThemeProvider as StyledComponentsThemeProvider,
  css,
  createGlobalStyle,
} from 'styled-components'
import BackgroundImage from '../assets/background.png'

const breakpoints = {
  xs: 0,
  sm: 600,
  md: 960,
  lg: 1280,
  xl: 1920,
}

const mediaQuery: {
  [width in keyof typeof breakpoints]: typeof css
} = Object.keys(breakpoints).reduce((accumulator, label) => {
  ;(accumulator as any)[label] = (a: any, b: any, c: any) => css`
    @media (min-width: ${(breakpoints as any)[label]}px) {
      ${css(a, b, c)}
    }
  `
  return accumulator
}, {}) as any

const black = '#FFFFFF'
const white = '#000000'

const theme = {
  mediaQuery,
  colors: {
    black,
    white,
    backgroundColor: black,
    textColor: white,
    gray300: '#8A9299',
    gray500: '#DCE1E6',
    gray700: '#FFFFFF',
    gray900: '#DCE1E6',
    blue300: '#8A9299',
    blue500: '#FFFFFF',
    blue700: '#DCE1E6',
    orange: '#FF6F00',
  },
}

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <StyledComponentsThemeProvider theme={theme}>
      {children}
    </StyledComponentsThemeProvider>
  )
}

export const GlobalStyle = createGlobalStyle`
  * {
    box-sizing: border-box;
  }

  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    -webkit-overflow-scrolling: touch;
  }

  html {
    font-size: 16px;
    font-family: 'Montserrat', sans-serif;
    font-variant: none;
    color: ${({ theme }) => theme.colors.textColor};
    background-color: ${({ theme }) => theme.colors.backgroundColor};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
  }

  #root {
    min-height: 100vh;
    background: url(${BackgroundImage});
    background-repeat: no-repeat;
    background-size: cover;
  }

  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  input[type="number"] {
    -moz-appearance: textfield;
  }
`
