import 'styled-components'

export type Color = string
export interface Colors {
  // base
  white: Color
  black: Color
  backgroundColor: Color
  textColor: Color
  gray300: Color
  gray500: Color
  gray700: Color
  gray900: Color
  blue300: Color
  blue500: Color
  blue700: Color
  orange: Color
}


declare module 'styled-components' {
  export interface DefaultTheme {
    // media queries
    mediaQuery: {
      xs: ThemedCssFunction<DefaultTheme>
      sm: ThemedCssFunction<DefaultTheme>
      md: ThemedCssFunction<DefaultTheme>
      lg: ThemedCssFunction<DefaultTheme>
      xl: ThemedCssFunction<DefaultTheme>
    }
    colors: Colors
  }
}