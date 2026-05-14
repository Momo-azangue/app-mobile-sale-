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
   * Appelé une seule fois par session de scan, dès qu'un code est détecté.
   * Le scanner se ferme automatiquement après détection — c'est à l'appelant
   * de rouvrir s'il veut scanner plusieurs codes successifs.
   */
  onScan: (code: string) => void;
  /** Texte d'aide affiché en bas (ex: "Visez le code-barres du produit"). */
  hint?: string;
}

/**
 * Modal plein-écran qui ouvre la caméra arrière pour scanner un code-barres
 * ou QR. Demande la permission caméra à la première ouverture, gère le
 * fallback web (non supporté).
 *
 * Réutilisable sur tout écran qui a besoin de scanner : recherche produit,
 * ajout de mouvement de stock, vente avec sérialisation IMEI…
 */
export function BarcodeScanner({ visible, onClose, onScan, hint }: BarcodeScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [permissionRequested, setPermissionRequested] = useState(false);
  // Garde-fou : sur Android, onBarcodeScanned peut être déclenché plusieurs
  // fois en quelques ms pour le même code. On n'émet qu'une fois par session.
  const emittedRef = useRef(false);
  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    if (!visible) {
      emittedRef.current = false;
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

  const handleBarcode = (result: BarcodeScanningResult) => {
    if (emittedRef.current) {
      return;
    }
    const scanned = (result.data ?? '').trim();
    if (!scanned) {
      return;
    }
    emittedRef.current = true;
    onScan(scanned);
    onClose();
  };

  const ready = visible && !isWeb && permission?.granted;

  return (
    <Modal visible={visible} animationType='slide' onRequestClose={onClose}>
      <View style={styles.container}>
        {ready ? (
          <CameraView
            style={styles.camera}
            facing='back'
            barcodeScannerSettings={{
              barcodeTypes: ['code128', 'code39', 'ean13', 'ean8', 'upc_a', 'upc_e', 'qr'],
            }}
            onBarcodeScanned={handleBarcode}
          />
        ) : null}

        <View style={styles.overlay} pointerEvents='box-none'>
          <View style={styles.hintBox}>
            <Text style={styles.hintText}>
              {hint ?? "Visez le code-barres du produit"}
            </Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral900,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    maxWidth: '90%',
  },
  hintText: {
    ...typography.label,
    color: colors.white,
    textAlign: 'center',
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
