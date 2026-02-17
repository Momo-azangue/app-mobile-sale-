import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../api/errors';
import { listPlans } from '../../api/services';
import { API_BASE_URL } from '../../config/env';
import type { RegisterRequestDTO, SubscriptionPlanDTO } from '../../types/api';

type AuthMode = 'login' | 'register';

export function LoginScreen() {
  const { loginWithPassword, registerAndLogin, isAuthenticating } = useAuth();

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
        if (!planId && fetched.length > 0) {
          setPlanId(fetched[0].id);
        }
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

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
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
                placeholderTextColor='#9CA3AF'
              />

              <Text style={styles.label}>Mot de passe</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder='********'
                placeholderTextColor='#9CA3AF'
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable
                style={[styles.button, !canLogin && styles.buttonDisabled]}
                onPress={onLoginSubmit}
                disabled={!canLogin}
              >
                {isAuthenticating ? (
                  <ActivityIndicator color='#FFFFFF' />
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
                placeholderTextColor='#9CA3AF'
              />

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={registerEmail}
                onChangeText={setRegisterEmail}
                autoCapitalize='none'
                keyboardType='email-address'
                placeholder='admin@boutique.com'
                placeholderTextColor='#9CA3AF'
              />

              <Text style={styles.label}>Mot de passe (min 8)</Text>
              <TextInput
                style={styles.input}
                value={registerPassword}
                onChangeText={setRegisterPassword}
                secureTextEntry
                placeholder='********'
                placeholderTextColor='#9CA3AF'
              />

              <Text style={styles.label}>Nom boutique</Text>
              <TextInput
                style={styles.input}
                value={storeName}
                onChangeText={setStoreName}
                placeholder='Ma Boutique'
                placeholderTextColor='#9CA3AF'
              />

              <Text style={styles.label}>Plan</Text>
              {plansLoading ? (
                <View style={styles.planLoading}>
                  <ActivityIndicator size='small' color='#4338CA' />
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
                  <ActivityIndicator color='#FFFFFF' />
                ) : (
                  <Text style={styles.buttonText}>Creer mon compte</Text>
                )}
              </Pressable>
            </>
          )}

          <Text style={styles.envText}>Backend: {API_BASE_URL}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 6,
    marginBottom: 16,
  },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    padding: 4,
    marginBottom: 14,
  },
  modeButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  modeText: {
    color: '#4B5563',
    fontWeight: '600',
  },
  modeTextActive: {
    color: '#4338CA',
  },
  label: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  plansWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 8,
  },
  planChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  planChipActive: {
    borderColor: '#4338CA',
    backgroundColor: '#EEF2FF',
  },
  planChipText: {
    color: '#374151',
    fontWeight: '500',
  },
  planChipTextActive: {
    color: '#4338CA',
    fontWeight: '700',
  },
  planLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  planLoadingText: {
    color: '#6B7280',
    fontSize: 13,
  },
  planFallback: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 8,
  },
  error: {
    color: '#B91C1C',
    marginTop: 12,
  },
  button: {
    marginTop: 18,
    borderRadius: 999,
    backgroundColor: '#4338CA',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  envText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 12,
  },
});
