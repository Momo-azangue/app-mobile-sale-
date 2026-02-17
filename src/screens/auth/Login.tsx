import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../api/errors';
import { listPlans } from '../../api/services';
import { API_BASE_URL } from '../../config/env';
import { colors, radius, shadows } from '../../theme/tokens';
import { typography } from '../../theme/typography';
import type { RegisterRequestDTO, SubscriptionPlanDTO } from '../../types/api';

type AuthMode = 'login' | 'register';

export function LoginScreen() {
  const { loginWithPassword, registerAndLogin, isAuthenticating } = useAuth();
  const { width } = useWindowDimensions();

  const [mode, setMode] = useState<AuthMode>('login');
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [storeName, setStoreName] = useState('');
  const [planId, setPlanId] = useState('');

  const [plans, setPlans] = useState<SubscriptionPlanDTO[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadPlans = async () => {
      setPlansLoading(true);
      try {
        const fetched = await listPlans();
        if (!mounted) {
          return;
        }

        setPlans(fetched);
        setPlanId((previous) => (previous ? previous : fetched[0]?.id ?? previous));
      } catch {
        if (mounted) {
          setPlans([]);
        }
      } finally {
        if (mounted) {
          setPlansLoading(false);
        }
      }
    };

    void loadPlans();

    return () => {
      mounted = false;
    };
  }, []);

  const canLogin = email.trim().length > 0 && password.trim().length > 0 && !isAuthenticating;
  const canRegister =
    registerName.trim().length > 0 &&
    registerEmail.trim().length > 0 &&
    registerPassword.trim().length >= 8 &&
    storeName.trim().length > 0 &&
    !isAuthenticating;

  const safePlanId = useMemo(() => {
    if (planId.trim().length > 0) {
      return planId.trim();
    }
    return plans[0]?.id || 'basic';
  }, [planId, plans]);

  const onLoginSubmit = async () => {
    if (!canLogin) {
      return;
    }

    try {
      setError(null);
      await loginWithPassword(email.trim(), password);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    }
  };

  const onRegisterSubmit = async () => {
    if (!canRegister) {
      return;
    }

    const payload: RegisterRequestDTO = {
      user: {
        name: registerName.trim(),
        email: registerEmail.trim(),
        password: registerPassword,
        role: 'ADMIN',
      },
      tenant: {
        name: storeName.trim(),
        planId: safePlanId,
        subscriptionEndDate: null,
        emailContact: registerEmail.trim(),
      },
    };

    try {
      setError(null);
      await registerAndLogin(payload);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    }
  };

  const isDesktop = width >= 960;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.shell, isDesktop && styles.shellDesktop]}>
          {isDesktop ? (
            <View style={styles.leftPanel}>
              <Text style={styles.brand}>Sales App</Text>
              <Text style={styles.heroTitle}>Pilotez vos ventes et votre stock en temps reel.</Text>
              <Text style={styles.heroText}>
                Connectez-vous pour gerer clients, ventes, factures et mouvements de stock depuis le mobile.
              </Text>

              <View style={styles.pointList}>
                <Text style={styles.point}>- Auth securisee par token et tenant.</Text>
                <Text style={styles.point}>- Creation de ventes avec lignes produits.</Text>
                <Text style={styles.point}>- Suivi des factures payees / impayees / partielles.</Text>
              </View>
            </View>
          ) : null}

          <View style={[styles.card, isDesktop && styles.cardDesktop]}>
            <Text style={styles.title}>{mode === 'login' ? 'Connexion' : 'Inscription'}</Text>
            <Text style={styles.subtitle}>
              {mode === 'login'
                ? 'Connectez-vous pour acceder au back-office mobile.'
                : 'Creer un compte admin + boutique, puis connexion automatique.'}
            </Text>

            <View style={styles.modeRow}>
              <Pressable
                style={[styles.modeButton, mode === 'login' && styles.modeButtonActive]}
                onPress={() => {
                  setMode('login');
                  setError(null);
                }}
              >
                <Text style={[styles.modeText, mode === 'login' && styles.modeTextActive]}>Connexion</Text>
              </Pressable>

              <Pressable
                style={[styles.modeButton, mode === 'register' && styles.modeButtonActive]}
                onPress={() => {
                  setMode('register');
                  setError(null);
                }}
              >
                <Text style={[styles.modeText, mode === 'register' && styles.modeTextActive]}>Inscription</Text>
              </Pressable>
            </View>

            {mode === 'login' ? (
              <>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize='none'
                  keyboardType='email-address'
                  placeholder='admin@boutique.com'
                  placeholderTextColor={colors.neutral400}
                />

                <Text style={styles.label}>Mot de passe</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder='********'
                  placeholderTextColor={colors.neutral400}
                />

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <Pressable
                  style={[styles.button, !canLogin && styles.buttonDisabled]}
                  onPress={onLoginSubmit}
                  disabled={!canLogin}
                >
                  {isAuthenticating ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.buttonText}>Se connecter</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.label}>Nom complet</Text>
                <TextInput
                  style={styles.input}
                  value={registerName}
                  onChangeText={setRegisterName}
                  placeholder='Jean Dupont'
                  placeholderTextColor={colors.neutral400}
                />

                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={registerEmail}
                  onChangeText={setRegisterEmail}
                  autoCapitalize='none'
                  keyboardType='email-address'
                  placeholder='admin@boutique.com'
                  placeholderTextColor={colors.neutral400}
                />

                <Text style={styles.label}>Mot de passe (min 8)</Text>
                <TextInput
                  style={styles.input}
                  value={registerPassword}
                  onChangeText={setRegisterPassword}
                  secureTextEntry
                  placeholder='********'
                  placeholderTextColor={colors.neutral400}
                />

                <Text style={styles.label}>Nom boutique</Text>
                <TextInput
                  style={styles.input}
                  value={storeName}
                  onChangeText={setStoreName}
                  placeholder='Ma Boutique'
                  placeholderTextColor={colors.neutral400}
                />

                <Text style={styles.label}>Plan</Text>
                {plansLoading ? (
                  <View style={styles.planLoading}>
                    <ActivityIndicator size='small' color={colors.primary600} />
                    <Text style={styles.planLoadingText}>Chargement des plans...</Text>
                  </View>
                ) : plans.length > 0 ? (
                  <View style={styles.plansWrap}>
                    {plans.map((plan) => {
                      const active = safePlanId === plan.id;
                      return (
                        <Pressable
                          key={plan.id}
                          style={[styles.planChip, active && styles.planChipActive]}
                          onPress={() => setPlanId(plan.id)}
                        >
                          <Text style={[styles.planChipText, active && styles.planChipTextActive]}>
                            {plan.name || plan.id}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.planFallback}>Aucun plan recu, fallback automatique sur `basic`.</Text>
                )}

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <Pressable
                  style={[styles.button, !canRegister && styles.buttonDisabled]}
                  onPress={onRegisterSubmit}
                  disabled={!canRegister}
                >
                  {isAuthenticating ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.buttonText}>Creer mon compte</Text>
                  )}
                </Pressable>
              </>
            )}

            <Text style={styles.envText}>Backend: {API_BASE_URL}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral50,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  shell: {
    width: '100%',
    maxWidth: 980,
  },
  shellDesktop: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.neutral200,
    backgroundColor: colors.white,
    minHeight: 620,
    ...shadows.md,
  },
  leftPanel: {
    flex: 1,
    backgroundColor: colors.primary700,
    paddingHorizontal: 28,
    paddingVertical: 34,
    justifyContent: 'space-between',
  },
  brand: {
    color: colors.white,
    ...typography.bodyMedium,
  },
  heroTitle: {
    marginTop: 24,
    color: colors.white,
    ...typography.display,
  },
  heroText: {
    marginTop: 12,
    color: colors.primary100,
    ...typography.label,
  },
  pointList: {
    marginTop: 24,
    gap: 10,
  },
  point: {
    ...typography.label,
    color: colors.primary100,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.neutral200,
    padding: 20,
    ...shadows.sm,
  },
  cardDesktop: {
    borderWidth: 0,
    borderRadius: 0,
    maxWidth: 480,
    paddingHorizontal: 28,
    paddingVertical: 28,
  },
  title: {
    ...typography.h1,
    color: colors.neutral900,
  },
  subtitle: {
    ...typography.label,
    color: colors.neutral500,
    marginTop: 6,
    marginBottom: 16,
  },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: colors.neutral100,
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: 12,
  },
  modeButton: {
    flex: 1,
    borderRadius: radius.pill,
    paddingVertical: 8,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: colors.primary50,
  },
  modeText: {
    ...typography.label,
    color: colors.neutral600,
  },
  modeTextActive: {
    color: colors.primary600,
  },
  label: {
    ...typography.label,
    color: colors.neutral700,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.neutral300,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.neutral900,
    backgroundColor: colors.white,
  },
  plansWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 8,
  },
  planChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.neutral300,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  planChipActive: {
    borderColor: colors.primary200,
    backgroundColor: colors.primary50,
  },
  planChipText: {
    ...typography.label,
    color: colors.neutral700,
  },
  planChipTextActive: {
    color: colors.primary600,
    fontFamily: typography.label.fontFamily,
  },
  planLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  planLoadingText: {
    ...typography.caption,
    color: colors.neutral500,
  },
  planFallback: {
    ...typography.caption,
    color: colors.neutral500,
    marginTop: 8,
  },
  error: {
    ...typography.label,
    color: colors.danger600,
    marginTop: 12,
  },
  button: {
    marginTop: 18,
    borderRadius: radius.md,
    backgroundColor: colors.primary600,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.white,
    ...typography.label,
  },
  envText: {
    marginTop: 12,
    color: colors.neutral500,
    ...typography.caption,
  },
});
