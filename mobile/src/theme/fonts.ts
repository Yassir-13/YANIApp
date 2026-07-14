// Chargement des polices Yani Concept.
//
// IMPORTANT : on importe chaque .ttf depuis son SOUS-CHEMIN exact, et useFonts
// depuis expo-font — surtout PAS depuis l'index racine de @expo-google-fonts,
// dont le index.js référence des variantes italiques absentes du paquet
// (require cassé → « Unable to resolve …_Italic.ttf »).
//
// Usage (App.tsx) :
//   const fontsLoaded = useYaniFonts();
//   if (!fontsLoaded) return null;

import { useFonts } from 'expo-font';

// Cormorant Garamond (titres serif)
import CormorantGaramond_500Medium from '@expo-google-fonts/cormorant-garamond/500Medium/CormorantGaramond_500Medium.ttf';
import CormorantGaramond_600SemiBold from '@expo-google-fonts/cormorant-garamond/600SemiBold/CormorantGaramond_600SemiBold.ttf';
import CormorantGaramond_700Bold from '@expo-google-fonts/cormorant-garamond/700Bold/CormorantGaramond_700Bold.ttf';

// Great Vibes (signature « by Fati »)
import GreatVibes_400Regular from '@expo-google-fonts/great-vibes/400Regular/GreatVibes_400Regular.ttf';

// Inter (UI / corps)
import Inter_400Regular from '@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf';
import Inter_500Medium from '@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf';
import Inter_600SemiBold from '@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf';
import Inter_700Bold from '@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf';

export function useYaniFonts(): boolean {
  // Les clés DOIVENT correspondre aux fontFamily utilisées dans typography.ts
  const [loaded] = useFonts({
    CormorantGaramond_500Medium,
    CormorantGaramond_600SemiBold,
    CormorantGaramond_700Bold,
    GreatVibes_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  return loaded;
}