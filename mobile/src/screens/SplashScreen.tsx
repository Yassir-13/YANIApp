import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { typography, spacing } from '../theme/typography';
import Drop from '../components/Drop';

const { width } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish: () => void; // appelé quand l'animation est terminée
}

// Splash animé, fond noir profond (identité de marque, indépendant du thème).
// Séquence calibrée à ~4,5 s : fondu d'entrée du fond (absorbe la bascule
// depuis le splash natif, évite le saut), puis halo + goutte, puis lettrage,
// puis barre dorée, puis pause. Aucune image : tout est vectoriel.
export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const rootOpacity = useRef(new Animated.Value(0)).current;
  const dropOpacity = useRef(new Animated.Value(0)).current;
  const dropTranslate = useRef(new Animated.Value(-20)).current;
  const haloScale = useRef(new Animated.Value(0.7)).current;
  const haloOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslate = useRef(new Animated.Value(12)).current;
  const barWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // 0) Fondu d'entrée du fond — absorbe la transition depuis le splash natif
      Animated.timing(rootOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),

      // 1) Halo + goutte apparaissent ensemble (posé)
      Animated.parallel([
        Animated.timing(haloOpacity, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(haloScale, { toValue: 1, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(dropOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(dropTranslate, { toValue: 0, duration: 1200, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true }),
      ]),

      // 2) Le lettrage monte en fondu
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(titleTranslate, { toValue: 0, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),

      // 3) La barre dorée se trace
      Animated.timing(barWidth, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),

      // 4) Pause avant de laisser la place à l'app
      Animated.delay(2000),
    ]).start(() => onFinish());
    // Total ≈ 250 + 1200 + 700 + 600 + 2000 = 4750 ms de séquence,
    // dont ~4,5 s perçus (le fondu initial se superpose au natif).
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: rootOpacity }]}>
      {/* Halo doré radial */}
      <Animated.View
        style={[
          styles.haloWrap,
          { opacity: haloOpacity, transform: [{ scale: haloScale }] },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={['rgba(228,193,94,0.28)', 'transparent']}
          start={{ x: 0.5, y: 0.3 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.halo}
        />
      </Animated.View>

      {/* Goutte */}
      <Animated.View style={{ opacity: dropOpacity, transform: [{ translateY: dropTranslate }] }}>
        <Drop size={90} />
      </Animated.View>

      {/* Lettrage */}
      <Animated.View style={{ opacity: titleOpacity, transform: [{ translateY: titleTranslate }], alignItems: 'center' }}>
        <Text style={[typography.display, styles.title]}>Yani Concept</Text>
        <Text style={[typography.script, styles.script]} numberOfLines={1}>by Fati</Text>

        {/* Barre dorée */}
        <Animated.View
          style={[
            styles.bar,
            { width: barWidth.interpolate({ inputRange: [0, 1], outputRange: [0, 64] }) },
          ]}
        />

            <Text style={[typography.sectionLabel, styles.tagline]}>Centre de beauté</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#080808',
    alignItems: 'center',
    justifyContent: 'center',
  },
  haloWrap: {
    position: 'absolute',
    width: width * 1.2,
    height: width * 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    width: '100%',
    height: '100%',
    borderRadius: width * 0.6,
  },
  title: {
    color: '#F5EFE1',
    fontSize: 38,
    marginTop: spacing.xl,
  },
   script: {
    color: '#E4C15E',
    fontSize: 34,
    lineHeight: 54,        // ample : Great Vibes a de grands jambages, sinon le texte est rogné
    paddingVertical: 4,
    marginTop: spacing.xs,
    includeFontPadding: true,
  },
  bar: {
    height: 2,
    backgroundColor: '#D8A848',
    marginTop: spacing.lg,
  },
  tagline: {
    color: '#7A7161',
    letterSpacing: 3,
    marginTop: spacing.md,
  },
});