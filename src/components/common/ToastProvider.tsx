import type { ComponentProps, ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadows, spacing } from '../../theme/tokens';
import { typography } from '../../theme/typography';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastPayload {
  id: number;
  variant: ToastVariant;
  title: string;
  message: string;
}

interface ToastApi {
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  dismiss: () => void;
}

interface ToastProviderProps {
  children: ReactNode;
}

const ToastContext = createContext<ToastApi | null>(null);

const variantMeta: Record<
  ToastVariant,
  {
    title: string;
    icon: ComponentProps<typeof Feather>['name'];
    borderColor: string;
    backgroundColor: string;
    iconColor: string;
  }
> = {
  success: {
    title: 'Succes',
    icon: 'check-circle',
    borderColor: colors.success100,
    backgroundColor: colors.success100,
    iconColor: colors.success600,
  },
  error: {
    title: 'Erreur',
    icon: 'alert-circle',
    borderColor: colors.danger100,
    backgroundColor: colors.danger100,
    iconColor: colors.danger500,
  },
  info: {
    title: 'Info',
    icon: 'info',
    borderColor: colors.primary100,
    backgroundColor: colors.primary100,
    iconColor: colors.primary600,
  },
};

export function ToastProvider({ children }: ToastProviderProps) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextIdRef = useRef(1);
  const [toast, setToast] = useState<ToastPayload | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -16,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setToast(null);
      }
    });
  }, [clearTimer, opacity, translateY]);

  const show = useCallback(
    (variant: ToastVariant, message: string, title?: string) => {
      clearTimer();
      const meta = variantMeta[variant];
      setToast({
        id: nextIdRef.current,
        variant,
        title: title ?? meta.title,
        message,
      });
      nextIdRef.current += 1;

      opacity.setValue(0);
      translateY.setValue(-16);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();

      timerRef.current = setTimeout(dismiss, 3000);
    },
    [clearTimer, dismiss, opacity, translateY],
  );

  useEffect(() => clearTimer, [clearTimer]);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, title) => show('success', message, title),
      error: (message, title) => show('error', message, title),
      info: (message, title) => show('info', message, title),
      dismiss,
    }),
    [dismiss, show],
  );

  const meta = toast ? variantMeta[toast.variant] : null;

  return (
    <ToastContext.Provider value={api}>
      {children}
      <View pointerEvents='box-none' style={[styles.host, { paddingTop: insets.top + spacing.sm }]}>
        {toast && meta ? (
          <Animated.View
            key={toast.id}
            style={[
              styles.toast,
              {
                opacity,
                transform: [{ translateY }],
                borderColor: meta.borderColor,
              },
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: meta.backgroundColor }]}>
              <Feather name={meta.icon} size={18} color={meta.iconColor} />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.title}>{toast.title}</Text>
              <Text style={styles.message}>{toast.message}</Text>
            </View>
            <Pressable onPress={dismiss} hitSlop={8} accessibilityLabel='Fermer la notification'>
              <Feather name='x' size={17} color={colors.neutral500} />
            </Pressable>
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: spacing.lg,
  },
  toast: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 560,
    minHeight: 58,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.md,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...typography.captionMedium,
    color: colors.neutral900,
  },
  message: {
    ...typography.caption,
    color: colors.neutral600,
  },
});
