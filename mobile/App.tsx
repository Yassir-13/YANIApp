import 'react-native-gesture-handler';
import { useState, useEffect, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { useYaniFonts } from './src/theme/fonts';
import RootNavigator from './src/navigation/RootNavigator';
import SplashScreen from './src/screens/SplashScreen';
import { AlertProvider } from './src/components/AlertProvider';

// Garde le splash natif visible jusqu'à ce que React soit prêt à peindre.
ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

function AppContent() {
  const { theme } = useTheme();
  return (
    <NavigationContainer>
      <RootNavigator />
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
    </NavigationContainer>
  );
}

export default function App() {
  const fontsLoaded = useYaniFonts();
  const [splashDone, setSplashDone] = useState(false);

  // Dès que les polices sont chargées, on masque le splash NATIF pour laisser
  // apparaître notre splash animé (qui utilise justement ces polices).
  useEffect(() => {
    if (fontsLoaded) {
      ExpoSplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  const handleSplashFinish = useCallback(() => setSplashDone(true), []);

  // Tant que les polices ne sont pas prêtes, on ne rend rien : le splash
  // natif (fond noir) reste affiché, sans flash de police système.
  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AlertProvider>
          {splashDone ? <AppContent /> : <SplashScreen onFinish={handleSplashFinish} />}
        </AlertProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}