// Diálogos con el sistema visual de la marca — reemplazan los Alert.alert
// nativos (que en Android/MIUI se ven feos). Portado del daemoni-alert, con la
// paleta de MDNotes (tinta/papel/bermellón) y soporte claro/oscuro.
//
// Uso imperativo, compatible con Alert.alert (migración mecánica):
//   import { appAlert } from '@/components/AppAlert';
//   appAlert('Eliminar', '¿Seguro?', [
//     { text: 'Cancelar', style: 'cancel' },
//     { text: 'Eliminar', style: 'destructive', onPress: () => {...} },
//   ]);
//
// <AlertProvider> debe envolver la app (ver app/_layout.tsx).

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import Svg, { Path, Line, Rect } from 'react-native-svg';
import { useTheme, fonts, radius, spacing, type Theme } from '@/theme';

type Variant = 'error' | 'warn' | 'success' | 'info';

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertConfig {
  variant?: Variant;
  title: string;
  message?: string;
  tag?: string;
  buttons?: AlertButton[];
  dismissable?: boolean;
}

// Setter registrado por el provider para la API imperativa global.
let showRef: ((cfg: AlertConfig) => void) | null = null;

// Bermellón es el único acento (brand book). Diferenciamos por ícono, no por
// color: error/warn/success usan bermellón; info usa sepia (neutro).
function accentFor(variant: Variant, theme: Theme) {
  return variant === 'info' ? theme.sepia : theme.accent;
}

function tintFor(variant: Variant) {
  // rgba suaves que funcionan en claro y oscuro.
  return variant === 'info' ? 'rgba(138,115,85,0.14)' : 'rgba(193,74,43,0.14)';
}

function VariantIcon({ variant, color }: { variant: Variant; color: string }) {
  const common = {
    width: 19,
    height: 19,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (variant) {
    case 'error':
      return (
        <Svg {...common}>
          <Path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <Path d="M13.7 21a2 2 0 0 1-3.4 0" />
          <Line x1="2" y1="2" x2="22" y2="22" />
        </Svg>
      );
    case 'warn':
      return (
        <Svg {...common}>
          <Path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          <Line x1="12" y1="9" x2="12" y2="13" />
          <Line x1="12" y1="17" x2="12.01" y2="17" />
        </Svg>
      );
    case 'success':
      return (
        <Svg {...common}>
          <Path d="M20 6 9 17l-5-5" />
        </Svg>
      );
    default:
      return (
        <Svg {...common}>
          <Rect x="3" y="3" width="18" height="18" rx="9" />
          <Path d="M12 16v-4M12 8h.01" />
        </Svg>
      );
  }
}

interface AlertCtx {
  show: (cfg: AlertConfig) => void;
  hide: () => void;
}
const AlertContext = createContext<AlertCtx | null>(null);

export function useAlert(): AlertCtx {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlert debe usarse dentro de <AlertProvider>');
  return ctx;
}

export function AlertProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const show = useCallback((cfg: AlertConfig) => setConfig(cfg), []);
  const hide = useCallback(() => setConfig(null), []);

  useEffect(() => {
    showRef = show;
    return () => {
      showRef = null;
    };
  }, [show]);

  return (
    <AlertContext.Provider value={{ show, hide }}>
      {children}
      <AlertModal config={config} onClose={hide} />
    </AlertContext.Provider>
  );
}

// Entrada: overlay fade + spring (escala 0.94→1, slide 8→0). Salida: fade 140ms.
function AlertModal({ config, onClose }: { config: AlertConfig | null; onClose: () => void }) {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const lastConfig = useRef<AlertConfig | null>(null);
  if (config) lastConfig.current = config;

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    if (config) {
      setVisible(true);
      scale.setValue(0.94);
      translateY.setValue(8);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 9, tension: 120, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, friction: 9, tension: 120, useNativeDriver: true }),
      ]).start();
    } else if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.96, duration: 140, useNativeDriver: true }),
      ]).start(() => setVisible(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  if (!visible || !lastConfig.current) return null;

  const {
    variant = 'info',
    title,
    tag,
    message,
    buttons = [{ text: 'Entendido', style: 'default' }],
    dismissable = true,
  } = lastConfig.current;
  const color = accentFor(variant, theme);
  const tint = tintFor(variant);
  const stack = buttons.length > 2; // >2 botones → apilados verticales

  const handlePress = (btn: AlertButton) => {
    onClose();
    btn.onPress?.();
  };

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={dismissable ? onClose : undefined}>
      <Animated.View style={[styles.overlay, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismissable ? onClose : undefined} />

        <Animated.View
          style={[
            styles.panel,
            { backgroundColor: theme.bg, borderColor: theme.line, transform: [{ scale }, { translateY }] },
          ]}
        >
          <View style={{ height: 3, backgroundColor: color }} />

          <View style={styles.body}>
            <View style={[styles.headerRow, { marginBottom: message ? spacing.md : 0 }]}>
              <View style={[styles.iconBox, { backgroundColor: tint }]}>
                <VariantIcon variant={variant} color={color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: theme.ink }]}>{title}</Text>
                {tag ? <Text style={[styles.tag, { color }]}>{tag}</Text> : null}
              </View>
            </View>
            {message ? <Text style={[styles.message, { color: theme.muted }]}>{message}</Text> : null}
          </View>

          <View style={[styles.buttons, stack && { flexDirection: 'column' }]}>
            {buttons.map((btn, i) => {
              const primary = btn.style === 'destructive' || (btn.style !== 'cancel' && i === buttons.length - 1);
              return (
                <Pressable
                  key={i}
                  onPress={() => handlePress(btn)}
                  style={({ pressed }) => [
                    styles.btn,
                    { borderColor: theme.line },
                    stack && { flex: undefined, width: '100%' },
                    primary && { backgroundColor: tint, borderColor: color },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.btnText, { color: primary ? color : theme.muted }]}>{btn.text}</Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// Infere la variante desde el título si no se pasa explícita.
function inferVariant(title: string, buttons?: AlertButton[]): Variant {
  const t = title.toLowerCase();
  if (/error|no se pudo|fall|inv[áa]lid|nada que|sin |no hay/.test(t)) return 'error';
  if (Array.isArray(buttons) && buttons.some((b) => b.style === 'destructive')) return 'warn';
  if (/listo|import|hecho|guardad|[ée]xito|elimina/.test(t)) return 'success';
  return 'info';
}

// API imperativa compatible con Alert.alert(title, message?, buttons?, opts?).
export function appAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  opts: { variant?: Variant; tag?: string; dismissable?: boolean } = {}
) {
  if (!showRef) return;
  showRef({
    variant: opts.variant || inferVariant(title, buttons),
    title,
    message,
    tag: opts.tag,
    buttons: buttons && buttons.length ? buttons : [{ text: 'Entendido', style: 'default' }],
    dismissable: opts.dismissable !== false,
  });
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,9,8,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  panel: {
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    elevation: 18,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
  },
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconBox: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.serifSemi, fontSize: 17, letterSpacing: -0.3 },
  tag: { fontFamily: fonts.mono, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 3 },
  message: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 21 },
  buttons: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  btn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  btnText: { fontFamily: fonts.sansMedium, fontSize: 13 },
});
