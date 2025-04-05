"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes"
import type { ThemeProviderProps } from "next-themes"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}

// 创建useTheme钩子
export function useTheme() {
  const [mounted, setMounted] = React.useState(false);
  const { theme, setTheme, systemTheme } = useNextTheme();
  
  React.useEffect(() => {
    setMounted(true);
  }, []);

  return {
    theme: mounted ? theme : undefined,
    setTheme,
    systemTheme: mounted ? systemTheme : undefined,
    mounted,
  };
}
