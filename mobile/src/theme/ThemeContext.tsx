import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { lightTheme, darkTheme, Theme } from './colors';

type ThemePreference = 'system' | 'light' | 'dark';
const PREF_KEY = 'yani_theme_preference';

interface ThemeContextValue {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  // Charge la préférence sauvegardée au démarrage
  useEffect(() => {
    SecureStore.getItemAsync(PREF_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setPreferenceState(saved);
      }
    });
  }, []);

  // Sauvegarde à chaque changement
  const setPreference = (pref: ThemePreference) => {
    setPreferenceState(pref);
    SecureStore.setItemAsync(PREF_KEY, pref);
  };

  const resolvedMode =
    preference === 'system' ? (systemScheme ?? 'light') : preference;
  const theme = resolvedMode === 'dark' ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme doit être utilisé dans un ThemeProvider.');
  }
  return ctx;
}