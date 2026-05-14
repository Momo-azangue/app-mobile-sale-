import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import {
  createCommerceSettings,
  getMyTenant,
  listCommerceSettings,
  listMyTenantUsers,
  requestEmailVerification,
  updateMyTenant,
  updateUserStatus,
} from '../api/services';
import { getErrorMessage } from '../api/errors';
import { useAuth } from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { colors } from '../theme/tokens';
import { typography } from '../theme/typography';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { AppButton } from '../components/common/AppButton';
import { AppCard } from '../components/common/AppCard';
import { InputField } from '../components/common/InputField';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import type { TenantResponseDTO, UserResponseDTO, UserStatus } from '../types/api';

const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: 'Actif',
  SUSPENDED: 'Suspendu',
  BLOCKED: 'Bloqué',
  REVOKED: 'Révoqué',
};

const USER_STATUS_COLORS: Record<UserStatus, string> = {
  ACTIVE: '#16a34a',     // vert
  SUSPENDED: '#f59e0b',  // ambre
  BLOCKED: '#dc2626',    // rouge
  REVOKED: '#6b7280',    // gris
};

interface ParametresScreenProps {
  refreshSignal: number;
  onSettingsChanged: () => void;
  onLogout: () => Promise<void>;
}

export function ParametresScreen({
  refreshSignal,
  onSettingsChanged,
  onLogout,
}: ParametresScreenProps) {
  const { session } = useAuth();
  const { refresh: refreshAppSettings } = useAppSettings();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [storeName, setStoreName] = useState('');
  const [currency, setCurrency] = useState('XAF');
  const [tenant, setTenant] = useState<TenantResponseDTO | null>(null);
  const [tenantUsers, setTenantUsers] = useState<UserResponseDTO[]>([]);

  const loadSettings = useCallback(async (showLoader: boolean = true) => {
    if (showLoader) {
      setLoading(true);
    }
    setError(null);

    try {
      const [settings, fetchedTenant, fetchedUsers] = await Promise.all([
        listCommerceSettings(),
        getMyTenant().catch(() => null),
        listMyTenantUsers().catch(() => [] as UserResponseDTO[]),
      ]);

      // Source d'autorité du nom : Tenant.name (saisi à l'inscription).
      // CommerceSettings.nom devient un fallback legacy.
      if (fetchedTenant?.name?.trim()) {
        setStoreName(fetchedTenant.name);
      } else if (settings.length > 0 && settings[settings.length - 1]?.nom?.trim()) {
        setStoreName(settings[settings.length - 1].nom);
      }
      // Devise reste portée par CommerceSettings (entité dédiée aux préférences UI)
      if (settings.length > 0 && settings[settings.length - 1]?.devise?.trim()) {
        setCurrency(settings[settings.length - 1].devise);
      }
      setTenant(fetchedTenant);
      setTenantUsers(fetchedUsers);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings(true);
  }, [loadSettings, refreshSignal]);
  const { refreshing, onRefresh } = usePullToRefresh(() => loadSettings(false));

  const handleSave = async () => {
    if (!storeName.trim()) {
      Alert.alert('Validation', 'Le nom de boutique est obligatoire.');
      return;
    }

    if (currency.trim().length !== 3) {
      Alert.alert('Validation', 'La devise doit contenir 3 caracteres (EUR, XAF, USD).');
      return;
    }

    setSaving(true);
    try {
      const trimmedName = storeName.trim();
      const normalizedCurrency = currency.trim().toUpperCase();

      // 1. Mise à jour du nom de boutique sur le tenant (source d'autorité)
      if (tenant && trimmedName !== tenant.name) {
        await updateMyTenant({
          name: trimmedName,
          planId: tenant.planId ?? '',
          subscriptionEndDate: tenant.subscriptionEndDate ?? null,
          emailContact: tenant.emailContact,
        });
      }

      // 2. CommerceSettings reste utilisé pour la devise (et legacy nom pour rétro-compat)
      await createCommerceSettings({
        nom: trimmedName,
        devise: normalizedCurrency,
        facturePDFActive: true,
      });

      // 3. Propage la nouvelle devise/nom à toute l'app (TopBar, Dashboard, etc.)
      await refreshAppSettings();

      Alert.alert('Succes', 'Parametres enregistres.');
      onSettingsChanged();
      await loadSettings();
    } catch (saveError) {
      Alert.alert('Erreur sauvegarde', getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Deconnexion', 'Voulez-vous vous deconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Se deconnecter',
        style: 'destructive',
        onPress: () => {
          void onLogout();
        },
      },
    ]);
  };

  /**
   * Affiche les actions disponibles pour un user selon son statut courant.
   * Le statut courant n'est pas proposé (pas de no-op).
   */
  const openUserActions = (user: UserResponseDTO) => {
    if (!user.id) {
      return;
    }
    const currentStatus = user.status ?? 'ACTIVE';
    const allTransitions: Array<{ label: string; status: UserStatus; destructive?: boolean }> = [
      { label: 'Réactiver', status: 'ACTIVE' },
      { label: 'Suspendre (pause temporaire)', status: 'SUSPENDED' },
      { label: 'Bloquer (sécurité)', status: 'BLOCKED', destructive: true },
      { label: 'Révoquer (accès retiré)', status: 'REVOKED', destructive: true },
    ];
    const available = allTransitions.filter((t) => t.status !== currentStatus);

    Alert.alert(
      user.name ?? user.email,
      `Statut actuel : ${USER_STATUS_LABELS[currentStatus]}`,
      [
        ...available.map((t) => ({
          text: t.label,
          style: t.destructive ? ('destructive' as const) : ('default' as const),
          onPress: () => confirmStatusChange(user, t.status),
        })),
        { text: 'Annuler', style: 'cancel' as const },
      ],
    );
  };

  const confirmStatusChange = (user: UserResponseDTO, newStatus: UserStatus) => {
    Alert.alert(
      'Confirmer',
      `Passer ${user.name ?? user.email} en statut "${USER_STATUS_LABELS[newStatus]}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          style: newStatus === 'ACTIVE' ? 'default' : 'destructive',
          onPress: () => {
            void applyStatusChange(user, newStatus);
          },
        },
      ],
    );
  };

  const applyStatusChange = async (user: UserResponseDTO, newStatus: UserStatus) => {
    if (!user.id) {
      return;
    }
    try {
      await updateUserStatus(user.id, { status: newStatus });
      Alert.alert('Succès', `${user.name ?? user.email} est maintenant ${USER_STATUS_LABELS[newStatus]}.`);
      await loadSettings(false);
    } catch (statusError) {
      Alert.alert('Erreur', getErrorMessage(statusError));
    }
  };

  const handleSendVerification = async () => {
    if (!session?.email) {
      Alert.alert('Session', 'Aucun email de session disponible.');
      return;
    }

    setSendingVerification(true);
    try {
      await requestEmailVerification({ email: session.email });
      Alert.alert(
        'Verification email',
        'Si le compte en a besoin, un email de verification a ete envoye.',
      );
    } catch (verificationError) {
      Alert.alert('Erreur verification', getErrorMessage(verificationError));
    } finally {
      setSendingVerification(false);
    }
  };

  if (loading) {
    return <LoadingState message='Chargement parametres...' />;
  }

  if (error) {
    return <ErrorState title='Erreur parametres' message={error} onRetry={() => void loadSettings()} />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary600} />
      }
    >
      <ScreenHeader title='Parametres' subtitle='Configuration boutique et session' />

      <AppCard style={styles.card}>
        <View style={styles.sectionHeader}>
          <Feather name='shopping-bag' size={18} color={colors.primary600} />
          <Text style={styles.sectionTitle}>Boutique</Text>
        </View>

        <InputField
          label='Nom de la boutique'
          value={storeName}
          onChangeText={setStoreName}
          autoCapitalize='words'
        />

        <InputField
          label='Devise'
          value={currency}
          onChangeText={setCurrency}
          autoCapitalize='characters'
          maxLength={3}
        />

        <Text style={styles.note}>
          Champs non supportes par l API actuelle masques pour le MVP: adresse, email boutique, notifications.
        </Text>

        <AppButton
          label={saving ? 'Sauvegarde...' : 'Sauvegarder'}
          onPress={() => {
            void handleSave();
          }}
          disabled={saving}
        />
      </AppCard>

      <AppCard style={styles.card}>
        <View style={styles.sectionHeader}>
          <Feather name='briefcase' size={18} color={colors.primary600} />
          <Text style={styles.sectionTitle}>Mon abonnement</Text>
        </View>

        {tenant ? (
          <>
            <View style={styles.accountMeta}>
              <Text style={styles.accountLabel}>Tenant</Text>
              <Text style={styles.accountValue}>{tenant.name}</Text>
            </View>
            {tenant.planId ? (
              <View style={styles.accountMeta}>
                <Text style={styles.accountLabel}>Plan</Text>
                <Text style={styles.accountValue}>{tenant.planId}</Text>
              </View>
            ) : null}
            {tenant.subscriptionEndDate ? (
              <View style={styles.accountMeta}>
                <Text style={styles.accountLabel}>Fin d abonnement</Text>
                <Text style={styles.accountValue}>{tenant.subscriptionEndDate}</Text>
              </View>
            ) : null}
            {tenant.emailContact ? (
              <View style={styles.accountMeta}>
                <Text style={styles.accountLabel}>Email contact</Text>
                <Text style={styles.accountValue}>{tenant.emailContact}</Text>
              </View>
            ) : null}
          </>
        ) : (
          <Text style={styles.note}>Informations tenant non disponibles.</Text>
        )}
      </AppCard>

      <AppCard style={styles.card}>
        <View style={styles.sectionHeader}>
          <Feather name='users' size={18} color={colors.primary600} />
          <Text style={styles.sectionTitle}>Mes employes ({tenantUsers.length})</Text>
        </View>

        {tenantUsers.length === 0 ? (
          <Text style={styles.note}>Aucun employe ou information non disponible.</Text>
        ) : (
          tenantUsers.map((u) => {
            const userStatus = u.status ?? 'ACTIVE';
            const isCurrentUser = session?.email && u.email
              && session.email.toLowerCase() === u.email.toLowerCase();
            return (
              <View key={u.email} style={styles.userRow}>
                <View style={styles.userRowMain}>
                  <Text style={styles.accountValue}>{u.name ?? u.email}</Text>
                  <Text style={styles.accountLabel}>{u.email}</Text>
                  <View style={styles.userMetaRow}>
                    <Text style={styles.userRowRole}>{u.role}</Text>
                    <Text style={[styles.userStatusBadge, { color: USER_STATUS_COLORS[userStatus] }]}>
                      • {USER_STATUS_LABELS[userStatus]}
                    </Text>
                  </View>
                </View>
                {isCurrentUser ? (
                  <Text style={styles.userSelfTag}>Vous</Text>
                ) : (
                  <Pressable
                    onPress={() => openUserActions(u)}
                    style={styles.userActionsButton}
                    hitSlop={10}
                  >
                    <Feather name='more-vertical' size={18} color={colors.neutral600} />
                  </Pressable>
                )}
              </View>
            );
          })
        )}
      </AppCard>

      <AppCard style={styles.card}>
        <View style={styles.sectionHeader}>
          <Feather name='shield' size={18} color={colors.primary600} />
          <Text style={styles.sectionTitle}>Compte et session</Text>
        </View>

        <View style={styles.accountMeta}>
          <Text style={styles.accountLabel}>Email</Text>
          <Text style={styles.accountValue}>{session?.email ?? 'Non disponible'}</Text>
        </View>

        <View style={styles.accountMeta}>
          <Text style={styles.accountLabel}>Role</Text>
          <Text style={styles.accountValue}>{session?.role ?? 'Non disponible'}</Text>
        </View>

        <Text style={styles.note}>
          Les nouveaux flux compte du backend sont exposes ici sans changer le parcours existant.
        </Text>

        <AppButton
          label={sendingVerification ? 'Envoi verification...' : 'Renvoyer l email de verification'}
          variant='outline'
          onPress={() => {
            void handleSendVerification();
          }}
          disabled={sendingVerification || !session?.email}
        />

        <AppButton label='Deconnexion' variant='danger' onPress={handleLogout} />
      </AppCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral50,
  },
  content: {
    paddingBottom: 96,
    paddingHorizontal: 16,
    paddingTop: 24,
    gap: 16,
  },
  card: {
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.neutral900,
  },
  note: {
    ...typography.caption,
    color: colors.neutral500,
  },
  accountMeta: {
    gap: 2,
  },
  accountLabel: {
    ...typography.captionMedium,
    color: colors.neutral500,
    textTransform: 'uppercase',
  },
  accountValue: {
    ...typography.bodyMedium,
    color: colors.neutral900,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
  },
  userRowMain: {
    flex: 1,
    gap: 2,
  },
  userRowRole: {
    ...typography.captionMedium,
    color: colors.primary600,
    textTransform: 'uppercase',
  },
  userMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  userStatusBadge: {
    ...typography.captionMedium,
    textTransform: 'uppercase',
  },
  userSelfTag: {
    ...typography.caption,
    color: colors.neutral500,
    fontStyle: 'italic',
  },
  userActionsButton: {
    padding: 6,
  },
});
