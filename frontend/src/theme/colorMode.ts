import { createContext, useContext } from 'react';

export type ThemeMode = 'light' | 'dark';

export const ColorModeContext = createContext<{ mode: ThemeMode; toggle: () => void }>({
    mode: 'light',
    toggle: () => {},
});

export const useColorMode = () => useContext(ColorModeContext);
