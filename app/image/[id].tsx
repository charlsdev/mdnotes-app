import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme, fonts, spacing } from '@/theme';
import { useFilesStore } from '@/storage/store';
import { openWithSystemViewer } from '@/storage/vault';
import { appAlert } from '@/components/AppAlert';

const MAX_SCALE = 6;

export default function ImageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { files, loaded, load } = useFilesStore();
  const file = files.find((f) => f.id === id);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  // Zoom y arrastre. `saved*` guarda el valor al terminar cada gesto para poder
  // encadenarlos (si no, cada pinch empezaría de cero).
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const reset = () => {
    scale.value = withTiming(1);
    savedScale.value = 1;
    x.value = withTiming(0);
    y.value = withTiming(0);
    savedX.value = 0;
    savedY.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX_SCALE, Math.max(1, savedScale.value * e.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      // Al volver a 1x se recentra: si no, la imagen queda "perdida" fuera de vista.
      if (scale.value <= 1.01) {
        x.value = withTiming(0);
        y.value = withTiming(0);
        savedX.value = 0;
        savedY.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (savedScale.value <= 1) return; // sin zoom no hay nada que arrastrar
      x.value = savedX.value + e.translationX;
      y.value = savedY.value + e.translationY;
    })
    .onEnd(() => {
      savedX.value = x.value;
      savedY.value = y.value;
    });

  // Doble toque: acerca, y si ya estaba acercado vuelve al tamaño original.
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (savedScale.value > 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        x.value = withTiming(0);
        y.value = withTiming(0);
        savedX.value = 0;
        savedY.value = 0;
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
      }
    });

  const gesture = Gesture.Simultaneous(pinch, Gesture.Exclusive(doubleTap, pan));

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  const openOutside = () => {
    if (!file?.uri) return;
    Haptics.selectionAsync();
    openWithSystemViewer(file.uri, file.name).catch((e: any) =>
      appAlert('No pude abrirla fuera', String(e?.message ?? e), undefined, { variant: 'error' })
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={[styles.topBar, { borderBottomColor: theme.line }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={[styles.backIcon, { color: theme.ink }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.muted }]} numberOfLines={1}>
          {file?.name ?? 'Imagen'}
        </Text>
        <TouchableOpacity onPress={reset} style={styles.back}>
          <Text style={[styles.icon, { color: theme.muted }]}>⤢</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={openOutside} style={styles.back}>
          <Text style={[styles.icon, { color: theme.accent }]}>⇱</Text>
        </TouchableOpacity>
      </View>

      {!file ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : failed ? (
        <View style={styles.center}>
          <Text style={[styles.error, { color: theme.muted }]}>No pude mostrar esta imagen.</Text>
          <TouchableOpacity onPress={openOutside} style={[styles.btn, { backgroundColor: theme.ink }]}>
            <Text style={[styles.btnText, { color: theme.bg }]}>ABRIR CON OTRA APP</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <GestureDetector gesture={gesture}>
          <Animated.View style={styles.stage}>
            <Animated.Image
              source={{ uri: file.uri }}
              style={[styles.image, style]}
              resizeMode="contain"
              onError={() => setFailed(true)}
            />
          </Animated.View>
        </GestureDetector>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  stage: { flex: 1, overflow: 'hidden' },
  image: { flex: 1, width: '100%' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 30, marginTop: -4 },
  icon: { fontSize: 17 },
  title: { flex: 1, fontFamily: fonts.mono, fontSize: 12 },
  error: { fontFamily: fonts.sans, fontSize: 13, textAlign: 'center' },
  btn: { paddingHorizontal: spacing.xl, paddingVertical: 12, borderRadius: 24 },
  btnText: { fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 1.2 },
});
