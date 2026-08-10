import { useEffect, useRef } from 'react';
import { Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { typography, spacing } from '../theme/typography';
import Drop from '../components/Drop';

const { width } = Dimensions.get('window');

const BAR_WIDTH = 64;      // largeur finale de la barre dorée
const SHEEN_WIDTH = 150;   // largeur du rai de lumière qui balaie le lettrage

interface SplashScreenProps {
  onFinish: () => void;      // appelé une fois le fondu de SORTIE terminé (pas avant)
  onExitStart?: () => void;  // appelé quand l'animation visible est finie, juste
                             // avant le fondu : c'est LE moment pour monter l'app
}

// Splash animé, fond noir profond (identité de marque, indépendant du thème).
// Séquence calibrée à ~4,5 s : fondu d'entrée du fond (absorbe la bascule
// depuis le splash natif, évite le saut), puis halo + goutte, puis lettrage,
// puis barre dorée, puis une pause habitée (le halo respire, un reflet doré
// balaie le lettrage), et enfin un fondu de sortie qui découvre l'app rendue
// en dessous. Aucune image : tout est vectoriel.
//
// Tout est en useNativeDriver : l'animation vit sur le thread UI. Le seul
// risque de saccade vient donc du MONTAGE de l'app (création des vues natives),
// qui est repoussé après la dernière animation visible via `onExitStart`.
export default function SplashScreen({ onFinish, onExitStart }: SplashScreenProps) {
  const rootOpacity = useRef(new Animated.Value(0)).current;
  const dropOpacity = useRef(new Animated.Value(0)).current;
  const dropTranslate = useRef(new Animated.Value(-20)).current;
  const haloScale = useRef(new Animated.Value(0.7)).current;
  const haloOpacity = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;   // respiration du halo
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslate = useRef(new Animated.Value(12)).current;
  const barScale = useRef(new Animated.Value(0)).current;
  const sheen = useRef(new Animated.Value(0)).current;   // balayage du reflet

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

      // 3) La barre dorée se trace (scaleX : reste sur le thread natif, donc
      //    fluide même sur téléphone lent — animer `width` aurait forcé le JS)
      Animated.timing(barScale, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),

      // 4) Pause habitée : un reflet doré traverse le lettrage pendant que le
      //    halo continue de respirer. L'écran ne paraît jamais figé.
      Animated.sequence([
        Animated.delay(150),
        Animated.timing(sheen, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ]).start(({ finished }) => {
      if (!finished) return;

      // 5) Plus rien ne bouge à l'écran (hors respiration du halo, qui tourne
      //    sur le thread UI) : c'est ici qu'on monte l'app. Le pic de travail
      //    du montage ne peut donc plus saccader une animation en cours.
      onExitStart?.();

      // 6) Court temps de calme pour laisser l'app se monter, puis fondu de
      //    sortie : elle se découvre en douceur au lieu d'apparaître d'un coup.
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(rootOpacity, {
          toValue: 0,
          duration: 450,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished: done }) => {
        if (done) onFinish();
      });
    });
    // Total = 250 + 1200 + 700 + 600 + 1150 + 400 + 450 = 4750 ms, minutage inchangé.
  }, []);

  // Respiration du halo : démarre quand le halo a fini d'apparaître (250 + 1200)
  // et tourne en boucle jusqu'au démontage.
  useEffect(() => {
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const timer = setTimeout(() => breathing.start(), 1450);
    return () => {
      clearTimeout(timer);
      breathing.stop();
    };
  }, []);

  // Le halo combine son entrée (haloScale/haloOpacity) et sa respiration (pulse).
  const breathScale = Animated.multiply(
    haloScale,
    pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }),
  );
  const breathOpacity = Animated.multiply(
    haloOpacity,
    pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.72] }),
  );

  // Le reflet traverse le lettrage de gauche à droite, centré sur lui.
  const sheenTranslate = sheen.interpolate({
    inputRange: [0, 1],
    outputRange: [-width * 0.55, width * 0.55],
  });
  // ... et fond en entrée comme en sortie : sans ça, la bande apparaît et
  // disparaît d'un coup et on voit passer un rectangle au lieu d'une lueur.
  const sheenOpacity = sheen.interpolate({
    inputRange: [0, 0.18, 0.82, 1],
    outputRange: [0, 1, 1, 0],
  });

  return (
    <Animated.View style={[styles.container, { opacity: rootOpacity }]}>
      {/* Fond noir de marque : icônes de la barre d'état forcées en clair */}
      <StatusBar style="light" />

      {/* Halo doré radial */}
      <Animated.View
        style={[
          styles.haloWrap,
          { opacity: breathOpacity, transform: [{ scale: breathScale }] },
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
        <Animated.View style={[styles.bar, { transform: [{ scaleX: barScale }] }]} />

            <Text style={[typography.sectionLabel, styles.tagline]}>Centre de beauté</Text>

        {/* Reflet : bande lumineuse inclinée qui traverse le lettrage une fois.
            Volontairement SANS overflow:hidden — un clip rectangulaire donnait
            des bords droits nets (on voyait passer un rectangle) et forçait un
            rendu hors écran coûteux sur Android. Le fondu est porté par
            l'opacité, et le dégradé s'éteint de lui-même sur les côtés. */}
        <Animated.View
          style={[
            styles.sheenBand,
            { opacity: sheenOpacity, transform: [{ translateX: sheenTranslate }, { rotate: '12deg' }] },
          ]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={[
              'transparent',
              'rgba(245,239,225,0.04)',
              'rgba(245,239,225,0.12)',
              'rgba(228,193,94,0.06)',
              'transparent',
            ]}
            locations={[0, 0.28, 0.5, 0.72, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sheenFill}
          />
        </Animated.View>
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
    // Garantit que le splash reste au-dessus de l'app montée en dessous
    zIndex: 10,
    elevation: 10,
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
    width: BAR_WIDTH,
    height: 2,
    backgroundColor: '#D8A848',
    marginTop: spacing.lg,
  },
  tagline: {
    color: '#7A7161',
    letterSpacing: 3,
    marginTop: spacing.md,
  },
  sheenBand: {
    position: 'absolute',
    top: -12, bottom: -12,   // déborde à peine, pour couvrir malgré l'inclinaison
    width: SHEEN_WIDTH,
    alignSelf: 'center',     // translateX part donc du centre du lettrage
  },
  sheenFill: {
    flex: 1,
  },
});
