import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../api/errors';
import { listPlans } from '../../api/services';
import { API_BASE_URL } from '../../config/env';
import { colors, radius, shadows } from '../../theme/tokens';
import { typography } from '../../theme/typography';
import type { RegisterRequestDTO, SubscriptionPlanDTO } from '../../types/api';
import { AppCard } from '../../components/common/AppCard';
import type { ChipOption } from '../../components/common/ChipGroup';
import { SegmentedControl } from '../../components/common/SegmentedControl';
import { DesktopPromoPanel } from './components/DesktopPromoPanel';
import { LoginFormSection } from './components/LoginFormSection';
import { RegisterFormSection } from './components/RegisterFormSection';

type AuthMode = 'login' | 'register';

const AUTH_MODE_OPTIONS = [
  { label: 'Connexion', value: 'login' },
  { label: 'Inscription', value: 'register' },
] as const;

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

  const planOptions = useMemo<ChipOption[]>(
    () => plans.map((plan) => ({ label: plan.name || plan.id, value: plan.id })),
    [plans],
  );

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
          {isDesktop ? <DesktopPromoPanel /> : null}

          <AppCard style={[styles.card, isDesktop && styles.cardDesktop]}>
            <Text style={styles.title}>{mode === 'login' ? 'Connexion' : 'Inscription'}</Text>
            <Text style={styles.subtitle}>
              {mode === 'login'
                ? 'Connectez-vous pour acceder au back-office mobile.'
                : 'Creer un compte admin + boutique, puis connexion automatique.'}
            </Text>

            <SegmentedControl
              options={[...AUTH_MODE_OPTIONS]}
              value={mode}
              onChange={(value) => {
                setMode(value as AuthMode);
                setError(null);
              }}
            />

            <View style={styles.formSection}>
              {mode === 'login' ? (
                <LoginFormSection
                  email={email}
                  password={password}
                  isLoading={isAuthenticating}
                  canSubmit={canLogin}
                  error={error}
                  onEmailChange={setEmail}
                  onPasswordChange={setPassword}
                  onSubmit={() => {
                    void onLoginSubmit();
                  }}
                />
              ) : (
                <RegisterFormSection
                  registerName={registerName}
                  registerEmail={registerEmail}
                  registerPassword={registerPassword}
                  storeName={storeName}
                  plansLoading={plansLoading}
                  planOptions={planOptions}
                  selectedPlanId={safePlanId}
                  isLoading={isAuthenticating}
                  canSubmit={canRegister}
                  error={error}
                  onRegisterNameChange={setRegisterName}
                  onRegisterEmailChange={setRegisterEmail}
                  onRegisterPasswordChange={setRegisterPassword}
                  onStoreNameChange={setStoreName}
                  onPlanSelect={setPlanId}
                  onSubmit={() => {
                    void onRegisterSubmit();
                  }}
                />
              )}
            </View>

            <Text style={styles.envText}>Backend: {API_BASE_URL}</Text>
          </AppCard>
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
  card: {
    width: '100%',
    maxWidth: 460,
    borderRadius: radius.lg,
  },
  cardDesktop: {
    borderWidth: 0,
    borderRadius: 0,
    maxWidth: 480,
    paddingHorizontal: 28,
    paddingVertical: 28,
    shadowOpacity: 0,
    elevation: 0,
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
  formSection: {
    marginTop: 12,
    gap: 12,
  },
  envText: {
    marginTop: 12,
    color: colors.neutral500,
    ...typography.caption,
  },
});
