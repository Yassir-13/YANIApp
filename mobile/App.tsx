import 'react-native-gesture-handler';
import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { useYaniFonts } from './src/theme/fonts';
import { initI18n } from './src/i18n';
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
  // La langue est lue dans le stockage local, donc de façon asynchrone : sans
  // cette attente, le premier rendu partirait en français avant de basculer
  // sous les yeux de la cliente.
  const [langReady, setLangReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  // L'app n'est montée qu'une fois l'animation du splash terminée : créer les
  // vues natives de la navigation bloque le thread UI, ce qui faisait saccader
  // le splash quand tout démarrait en même temps.
  const [appMounted, setAppMounted] = useState(false);

  // `finally` et non `then` : si la lecture du stockage échouait, l'app
  // démarrerait dans la langue de l'appareil plutôt que de rester bloquée sur
  // un écran vide.
  useEffect(() => {
    initI18n().finally(() => setLangReady(true));
  }, []);

  // Dès que les polices sont chargées, on masque le splash NATIF pour laisser
  // apparaître notre splash animé (qui utilise justement ces polices).
  useEffect(() => {
    if (fontsLoaded) {
      ExpoSplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  const handleSplashExitStart = useCallback(() => setAppMounted(true), []);
  const handleSplashFinish = useCallback(() => setSplashDone(true), []);

  // Tant que les polices et la langue ne sont pas prêtes, on ne rend rien : le
  // splash natif (fond noir) reste affiché, sans flash de police système.
  if (!fontsLoaded || !langReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AlertProvider>
          {/* L'app se monte SOUS le splash, mais seulement quand l'animation
              est finie : le splash reste fluide, et il a toujours quelque chose
              à découvrir pendant son fondu de sortie. */}
          <View style={styles.root}>
            {appMounted && <AppContent />}
            {!splashDone && (
              <SplashScreen onExitStart={handleSplashExitStart} onFinish={handleSplashFinish} />
            )}
          </View>
        </AlertProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});