import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';

import { colors, radius } from '../../theme/tokens';
import { typography } from '../../theme/typography';

interface ImeiInputProps {
  /** Texte libre — IMEI multi-lignes séparés par virgule, point-virgule ou saut de ligne. */
  value: string;
  onChangeText: (value: string) => void;
  label: string;
  /** Hint affiché sous le champ (ex: "Disponibles : XX, YY"). */
  helperText?: string;
  placeholder?: string;
  /** Désactive le bouton scan (utile si on saisit aussi à la main sans scan). */
  disableScan?: boolean;
}

/**
 * Champ texte pour saisir un ou plusieurs IMEI / numéros de série, avec un bouton
 * caméra à côté qui ouvre un scanner code-barres / QR. Chaque scan ajoute la valeur
 * détectée au texte (séparateur saut de ligne).
 *
 * Le composant accepte la saisie clavier classique (utile si scanner USB Bluetooth
 * agissant comme un clavier, ou saisie manuelle).
 */
export function ImeiInput({
  value,
  onChangeText,
  label,
  helperText,
  placeholder = 'IMEI / numéro de série',
  disableScan = false,
}: ImeiInputProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scannerVisible, setScannerVisible] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    if (!scannerVisible) {
      setLastScanned(null);
    }
  }, [scannerVisible]);

  const openScanner = async () => {
    if (isWeb) {
      Alert.alert('Scan indisponible', 'Le scan caméra n\'est pas pris en charge sur la version web.');
      return;
    }
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          'Permission refusée',
          "L'accès à la caméra est nécessaire pour scanner les IMEI. Activez-le dans les paramètres système.",
        );
        return;
      }
    }
    setScannerVisible(true);
  };

  const handleBarcode = (result: BarcodeScanningResult) => {
    const scanned = (result.data ?? '').trim();
    if (!scanned || scanned === lastScanned) {
      return;
    }
    setLastScanned(scanned);
    // Append en respectant la convention du composant : séparateur saut de ligne.
    const trimmedExisting = value.trim();
    const next = trimmedExisting.length > 0 ? `${trimmedExisting}\n${scanned}` : scanned;
    onChangeText(next);
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.neutral400}
          multiline
          autoCapitalize='characters'
          autoCorrect={false}
        />
        {!disableScan ? (
          <Pressable
            style={styles.scanButton}
            onPress={() => {
              void openScanner();
            }}
            hitSlop={6}
            accessibilityLabel='Scanner un code-barres'
          >
            <Feather name='camera' size={18} color={colors.white} />
          </Pressable>
        ) : null}
      </View>
      {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}

      <Modal
        visible={scannerVisible}
        animationType='slide'
        onRequestClose={() => setScannerVisible(false)}
      >
        <View style={styles.scannerContainer}>
          {scannerVisible ? (
            <CameraView
              style={styles.camera}
              facing='back'
              barcodeScannerSettings={{
                barcodeTypes: ['code128', 'code39', 'ean13', 'ean8', 'upc_a', 'upc_e', 'qr'],
              }}
              onBarcodeScanned={handleBarcode}
            />
          ) : null}
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerHint}>
              <Text style={styles.scannerHintText}>
                Visez le code-barres ou QR sur l'emballage
              </Text>
              {lastScanned ? (
                <Text style={styles.scannerLastText}>Dernier scan : {lastScanned}</Text>
              ) : null}
            </View>
            <Pressable
              style={styles.scannerClose}
              onPress={() => setScannerVisible(false)}
            >
              <Text style={styles.scannerCloseText}>Terminer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  label: {
    ...typography.label,
    color: colors.neutral700,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  input: {
    flex: 1,
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.neutral300,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.neutral900,
    backgroundColor: colors.white,
    minHeight: 48,
  },
  scanButton: {
    width: 48,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary600,
  },
  helper: {
    ...typography.caption,
    color: colors.neutral500,
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 24,
    paddingBottom: 48,
    gap: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  scannerHint: {
    gap: 4,
  },
  scannerHintText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
  scannerLastText: {
    ...typography.caption,
    color: colors.neutral200,
  },
  scannerClose: {
    backgroundColor: colors.white,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  scannerCloseText: {
    ...typography.bodyMedium,
    color: colors.neutral900,
  },
});
