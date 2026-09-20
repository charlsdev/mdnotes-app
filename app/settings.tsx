import { View, Text, StyleSheet, TouchableOpacity, Pressable, Switch, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme, fonts, spacing, radius } from '@/theme';
import {
  useSettings,
  PDF_MARGINS,
  THEME_OPTIONS,
  READING_SIZES,
  READING_FONTS,
  ATTACHMENT_MODES,
} from '@/storage/settings';
import { sanitizeFolderPath, type AttachmentMode } from '@/lib/paths';
import { Footer } from '@/components/Footer';

// Qué va a pasar, en concreto: el modo por sí solo no dice dónde termina la foto.
function attachmentHint(mode: AttachmentMode, folder: string): string {
  const clean = sanitizeFolderPath(folder);
  if (mode === 'auto') {
    return 'Sigo lo que ya usa tu carpeta: la config de Obsidian si la tiene, o la carpeta donde están las imágenes de tus notas.';
  }
  if (mode === 'note') {
    return clean
      ? `Cada foto va a una carpeta "${clean}" dentro de la carpeta de la nota. Una nota en Proyectos/ guarda en Proyectos/${clean}/.`
      : 'Cada foto va junto a la nota, en su misma carpeta.';
  }
  return clean
    ? `Todas las fotos van a "${clean}/", desde la raíz de la carpeta abierta.`
    : 'Todas las fotos van a la raíz de la carpeta abierta.';
}

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const {
    pdfMarginMm,
    autosave,
    theme: themePref,
    readingScale,
    readingFont,
    attachmentMode,
    attachmentFolder,
    setPdfMargin,
    setAutosave,
    setTheme,
    setReadingScale,
    setReadingFont,
    setAttachmentMode,
    setAttachmentFolder,
  } = useSettings();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={[styles.topBar, { borderBottomColor: theme.line }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={[styles.backIcon, { color: theme.ink }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.ink }]}>Ajustes</Text>
        <View style={styles.back} />
      </View>

      {/* `handled`: con el teclado abierto (campo de la carpeta), el primer toque
          en otra opción la activa en vez de perderse cerrando el teclado. */}
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* Apariencia */}
        <Text style={[styles.section, { color: theme.accent }]}>— TEMA</Text>
        <View style={styles.options}>
          {THEME_OPTIONS.map((opt) => {
            const active = opt.value === themePref;
            return (
              <Pressable
                key={opt.value}
                onPress={() => {
                  Haptics.selectionAsync();
                  setTheme(opt.value);
                }}
                style={[
                  styles.opt,
                  { borderColor: active ? theme.accent : theme.line, backgroundColor: active ? theme.accent + '14' : 'transparent' },
                ]}
              >
                <Text style={[styles.optLabel, { color: active ? theme.accent : theme.ink }]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Lectura: tamaño */}
        <Text style={[styles.section, { color: theme.accent }]}>— TAMAÑO DE LECTURA</Text>
        <View style={styles.options}>
          {READING_SIZES.map((opt) => {
            const active = opt.scale === readingScale;
            return (
              <Pressable
                key={opt.scale}
                onPress={() => {
                  Haptics.selectionAsync();
                  setReadingScale(opt.scale);
                }}
                style={[
                  styles.opt,
                  { borderColor: active ? theme.accent : theme.line, backgroundColor: active ? theme.accent + '14' : 'transparent' },
                ]}
              >
                <Text style={[styles.optLabel, { color: active ? theme.accent : theme.ink }]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Lectura: fuente */}
        <Text style={[styles.section, { color: theme.accent }]}>— FUENTE DE LECTURA</Text>
        <View style={styles.options}>
          {READING_FONTS.map((opt) => {
            const active = opt.value === readingFont;
            return (
              <Pressable
                key={opt.value}
                onPress={() => {
                  Haptics.selectionAsync();
                  setReadingFont(opt.value);
                }}
                style={[
                  styles.opt,
                  { borderColor: active ? theme.accent : theme.line, backgroundColor: active ? theme.accent + '14' : 'transparent' },
                ]}
              >
                <Text style={[styles.optLabel, { color: active ? theme.accent : theme.ink }]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.note, { color: theme.muted }]}>
          El tamaño se aplica al editor y a la vista; la fuente, a la vista (VER).
        </Text>

        {/* Guardado */}
        <Text style={[styles.section, { color: theme.accent }]}>— GUARDADO</Text>
        <View style={[styles.row, { borderBottomColor: theme.line }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: theme.ink }]}>Autoguardado</Text>
            <Text style={[styles.rowHint, { color: theme.muted }]}>
              {autosave
                ? 'Guarda solo mientras escribes.'
                : 'Guarda al tocar “Guardar” o al salir de la nota.'}
            </Text>
          </View>
          <Switch
            value={autosave}
            onValueChange={(v) => {
              Haptics.selectionAsync();
              setAutosave(v);
            }}
            trackColor={{ true: theme.accent, false: theme.line }}
            thumbColor="#f5f1ea"
          />
        </View>

        {/* Imágenes */}
        <Text style={[styles.section, { color: theme.accent }]}>— CARPETA DE IMÁGENES</Text>
        <View style={styles.options}>
          {ATTACHMENT_MODES.map((opt) => {
            const active = opt.value === attachmentMode;
            return (
              <Pressable
                key={opt.value}
                onPress={() => {
                  Haptics.selectionAsync();
                  setAttachmentMode(opt.value);
                }}
                style={[
                  styles.opt,
                  { borderColor: active ? theme.accent : theme.line, backgroundColor: active ? theme.accent + '14' : 'transparent' },
                ]}
              >
                <Text style={[styles.optLabel, { color: active ? theme.accent : theme.ink }]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {attachmentMode !== 'auto' && (
          <View style={[styles.input, { borderColor: theme.line }]}>
            <TextInput
              style={[styles.inputText, { color: theme.ink }]}
              value={attachmentFolder}
              onChangeText={setAttachmentFolder}
              placeholder="img"
              placeholderTextColor={theme.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        )}
        <Text style={[styles.note, { color: theme.muted }]}>{attachmentHint(attachmentMode, attachmentFolder)}</Text>

        {/* PDF */}
        <Text style={[styles.section, { color: theme.accent }]}>— MÁRGENES DEL PDF</Text>
        <View style={styles.options}>
          {PDF_MARGINS.map((opt) => {
            const active = opt.mm === pdfMarginMm;
            return (
              <Pressable
                key={opt.mm}
                onPress={() => {
                  Haptics.selectionAsync();
                  setPdfMargin(opt.mm);
                }}
                style={[
                  styles.opt,
                  { borderColor: active ? theme.accent : theme.line, backgroundColor: active ? theme.accent + '14' : 'transparent' },
                ]}
              >
                <Text style={[styles.optLabel, { color: active ? theme.accent : theme.ink }]}>{opt.label}</Text>
                <Text style={[styles.optMm, { color: theme.muted }]}>{opt.mm} mm</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.note, { color: theme.muted }]}>
          Se aplica al exportar una nota como PDF (hoja A4).
        </Text>

        <Footer />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  back: { width: 40, height: 32, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 30, marginTop: -4 },
  title: { flex: 1, fontFamily: fonts.serifSemi, fontSize: 18, textAlign: 'center' },
  section: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 2.5,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontFamily: fonts.sansMedium, fontSize: 15 },
  rowHint: { fontFamily: fonts.sans, fontSize: 12, marginTop: 2, lineHeight: 17 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.xl },
  opt: {
    flexGrow: 1,
    minWidth: 74,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 2,
  },
  optLabel: { fontFamily: fonts.sansMedium, fontSize: 14 },
  optMm: { fontFamily: fonts.mono, fontSize: 11 },
  input: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  inputText: { fontFamily: fonts.mono, fontSize: 14, paddingVertical: spacing.md },
  note: { fontFamily: fonts.sans, fontSize: 12, paddingHorizontal: spacing.xl, paddingTop: spacing.md, lineHeight: 17 },
});
