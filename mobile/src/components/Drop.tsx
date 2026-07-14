import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface DropProps {
  size?: number;          // hauteur en px (largeur ~0.72 * hauteur)
  colors?: [string, string, string]; // dégradé or (haut → bas)
}

// Goutte Yani en vectoriel : nette à toutes tailles, teintée via les tokens.
export default function Drop({
  size = 52,
  colors = ['#E4C15E', '#D8A848', '#886028'],
}: DropProps) {
  const width = size * 0.72;
  return (
    <Svg width={width} height={size} viewBox="0 0 24 33" accessibilityLabel="Goutte Yani">
      <Defs>
        <LinearGradient id="dropGold" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors[0]} />
          <Stop offset="0.55" stopColor={colors[1]} />
          <Stop offset="1" stopColor={colors[2]} />
        </LinearGradient>
      </Defs>
      {/* Goutte : pointe en haut, ventre arrondi en bas */}
      <Path
        d="M12 0 C12 0 2 13 2 21 C2 27.6 6.5 32.5 12 32.5 C17.5 32.5 22 27.6 22 21 C22 13 12 0 12 0 Z"
        fill="url(#dropGold)"
      />
    </Svg>
  );
}