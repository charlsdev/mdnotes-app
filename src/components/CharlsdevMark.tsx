import Svg, { Rect, Path } from 'react-native-svg';

// Marca de charlsdev (public/charlsdev.svg): una "C" con paréntesis angulares
// < > sobre fondo dorado. Reproducida en vectores para no depender de assets.
export function CharlsdevMark({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Rect width={200} height={200} rx={40} fill="#F5B544" />
      <Path
        d="M 130 56 A 52 52 0 1 0 130 144"
        stroke="#0A0A0B"
        strokeWidth={13}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M 96 80 L 80 100 L 96 120"
        stroke="#0A0A0B"
        strokeWidth={9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M 120 80 L 136 100 L 120 120"
        stroke="#0A0A0B"
        strokeWidth={9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
