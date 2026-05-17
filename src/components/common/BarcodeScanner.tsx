import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';

import { colors, radius } from '../../theme/tokens';
import { typography } from '../../theme/typography';

interface BarcodeScannerProps {
  visible: boolean;
  onClose: () => void;
  /**
   * Appelé une seule fois par session de scan, dès qu'un code est confirmé
   * (lu 2 fois identique + format valide). Le scanner se ferme ensuite
   * automatiquement.
   */
  onScan: (code: string) => void;
  /**
   * Type attendu — pilote la validation de format et la liste des
   * barcodeTypes activés (moins de formats = scan plus rapide, moins de
   * faux positifs).
   */
  expect?: 'product' | 'imei';
  /** Texte d'aide affiché en bas. */
  hint?: string;
}

/**
 * IMEI : 14 à 16 chiffres (15 standard GSM ; certains S/N téléphones 14/16).
 * Si tes produits SERIAL incluent des numéros alphanumériques (tablettes,
 * ordinateurs), élargir ce pattern.
 */
const IMEI_PATTERN = /^\d{14,16}$/;
/** Code produit : on accepte tout code-barres standard d'au moins 4 caractères. */
const PRODUCT_MIN_LENGTH = 4;
/** Nombre de lectures identiques consécutives requises avant de confirmer. */
const REQUIRED_CONSECUTIVE_READS = 2;
/** Délai d'affichage du feedback "confirmé" avant fermeture (ms). */
const CONFIRM_FEEDBACK_MS = 350;

const BARCODE_TYPES: Record<'product' | 'imei', ('code128' | 'code39' | 'ean13' | 'ean8' | 'upc_a' | 'upc_e' | 'qr')[]> = {
  // L'IMEI imprimé sur les boîtes téléphone est quasi toujours du code128/39.
  imei: ['code128', 'code39'],
  // Produit : panel large (EAN/UPC pour les articles du commerce, QR en secours).
  product: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'],
};

type Phase = 'scanning' | 'detecting' | 'confirmed' | 'rejected';

export function BarcodeScanner({ visible, onClose, onScan, expect = 'product', hint }: BarcodeScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [permissionRequested, setPermissionRequested] = useState(false);
  const [phase, setPhase] = useState<Phase>('scanning');
  const [feedback, setFeedback] = useState<string>('');

  // Garde-fou : on n'émet qu'une fois par session de scan.
  const emittedRef = useRef(false);
  // Double-lecture : on retient le dernier candidat et son compteur.
  const candidateRef = useRef<{ value: string; count: number }>({ value: '', count: 0 });
  // Évite les setState redondants à chaque frame caméra.
  const lastPhaseRef = useRef<Phase>('scanning');
  const feedbackRef = useRef('');

  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    if (!visible) {
      emittedRef.current = false;
      candidateRef.current = { value: '', count: 0 };
      lastPhaseRef.current = 'scanning';
      setPhase('scanning');
      setFeedback('');
      return;
    }
    if (isWeb) {
      Alert.alert(
        'Scan indisponible',
        "Le scan caméra n'est pas pris en charge sur la version web.",
      );
      onClose();
      return;
    }
    if (!permission?.granted && !permissionRequested) {
      setPermissionRequested(true);
      void requestPermission().then((result) => {
        if (!result.granted) {
          Alert.alert(
            'Permission refusée',
            "L'accès à la caméra est nécessaire pour scanner. Activez-le dans les paramètres système.",
          );
          onClose();
        }
      });
    }
  }, [visible, isWeb, permission?.granted, permissionRequested, requestPermission, onClose]);

  const updatePhase = (next: Phase, message: string) => {
    if (lastPhaseRef.current !== next || message !== feedbackRef.current) {
      lastPhaseRef.current = next;
      feedbackRef.current = message;
      setPhase(next);
      setFeedback(message);
    }
  };

  const isValidFormat = (code: string): boolean => {
    if (expect === 'imei') {
      return IMEI_PATTERN.test(code);
    }
    return code.length >= PRODUCT_MIN_LENGTH;
  };

  const handleBarcode = (result: BarcodeScanningResult) => {
    if (emittedRef.current) {
      return;
    }
    const scanned = (result.data ?? '').trim();
    if (!scanned) {
      return;
    }

    // 1. Validation de format selon le type attendu — on ignore (sans
    //    fermer) tout ce qui ne ressemble pas à la cible.
    if (!isValidFormat(scanned)) {
      candidateRef.current = { value: '', count: 0 };
      updatePhase(
        'rejected',
        expect === 'imei'
          ? 'Format attendu : IMEI 14-16 chiffres. Visez le bon code.'
          : 'Code non reconnu. Approchez et stabilisez.',
      );
      return;
    }

    // 2. Double-lecture : il faut N lectures identiques consécutives.
    if (candidateRef.current.value === scanned) {
      candidateRef.current.count += 1;
    } else {
      candidateRef.current = { value: scanned, count: 1 };
      updatePhase('detecting', 'Code détecté, maintenez la visée…');
      return;
    }

    if (candidateRef.current.count < REQUIRED_CONSECUTIVE_READS) {
      updatePhase('detecting', 'Lecture en cours…');
      return;
    }

    // 3. Confirmé : on émet une seule fois, court feedback visuel, fermeture.
    emittedRef.current = true;
    updatePhase('confirmed', 'Code confirmé ✓');
    setTimeout(() => {
      onScan(scanned);
      onClose();
    }, CONFIRM_FEEDBACK_MS);
  };

  const ready = visible && !isWeb && permission?.granted;
  const frameStyle =
    phase === 'confirmed'
      ? styles.frameConfirmed
      : phase === 'detecting'
      ? styles.frameDetecting
      : phase === 'rejected'
      ? styles.frameRejected
      : styles.frameScanning;

  const defaultHint =
    expect === 'imei' ? "Visez l'IMEI de l'article" : 'Visez le code-barres du produit';

  return (
    <Modal visible={visible} animationType='slide' onRequestClose={onClose}>
      <View style={styles.container}>
        {ready ? (
          <CameraView
            style={styles.camera}
            facing='back'
            barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES[expect] }}
            onBarcodeScanned={handleBarcode}
          />
        ) : null}

        {/* Masque sombre + fenêtre de visée centrale */}
        <View style={styles.mask} pointerEvents='box-none'>
          <View style={styles.maskRow} />
          <View style={styles.maskCenter}>
            <View style={styles.maskSide} />
            <View style={[styles.frame, frameStyle]}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
            <View style={styles.maskSide} />
          </View>
          <View style={styles.maskRow} />
        </View>

        <View style={styles.overlay} pointerEvents='box-none'>
          <View style={styles.hintBox}>
            <Text style={styles.hintText}>{hint ?? defaultHint}</Text>
            {feedback ? (
              <Text
                style={[
                  styles.feedbackText,
                  phase === 'confirmed' && styles.feedbackOk,
                  phase === 'rejected' && styles.feedbackWarn,
                ]}
              >
                {feedback}
              </Text>
            ) : null}
          </View>

          <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8}>
            <Feather name='x' size={20} color={colors.white} />
            <Text style={styles.closeText}>Fermer</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const FRAME_HEIGHT = 190;
const MASK_COLOR = 'rgba(0,0,0,0.6)';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral900,
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  mask: {
    ...StyleSheet.absoluteFillObject,
  },
  maskRow: {
    flex: 1,
    backgroundColor: MASK_COLOR,
  },
  maskCenter: {
    flexDirection: 'row',
    height: FRAME_HEIGHT,
  },
  maskSide: {
    flex: 1,
    backgroundColor: MASK_COLOR,
  },
  frame: {
    width: '78%',
    height: FRAME_HEIGHT,
    borderRadius: radius.md,
    borderWidth: 2,
  },
  frameScanning: {
    borderColor: 'rgba(255,255,255,0.7)',
  },
  frameDetecting: {
    borderColor: colors.warning600,
  },
  frameConfirmed: {
    borderColor: colors.success600,
  },
  frameRejected: {
    borderColor: colors.danger500,
  },
  corner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: colors.white,
  },
  cornerTL: { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: radius.md },
  cornerTR: { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: radius.md },
  cornerBL: { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: radius.md },
  cornerBR: { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: radius.md },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingBottom: 36,
    paddingHorizontal: 20,
  },
  hintBox: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '92%',
    gap: 4,
  },
  hintText: {
    ...typography.label,
    color: colors.white,
    textAlign: 'center',
  },
  feedbackText: {
    ...typography.captionMedium,
    color: colors.white,
    textAlign: 'center',
  },
  feedbackOk: {
    color: colors.success600,
  },
  feedbackWarn: {
    color: colors.warning600,
  },
  closeButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  closeText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
});
