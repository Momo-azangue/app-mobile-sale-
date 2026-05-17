import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import {
  changeMyPassword,
  createCommerceSettings,
  deleteCommerceLogo,
  getMyTenant,
  listCommerceSettings,
  listMyTenantUsers,
  requestEmailVerification,
  updateCommerceSettings,
  updateMyTenant,
  updateUserRole,
  updateUserStatus,
  uploadCommerceLogo,
} from '../api/services';
import { getErrorMessage } from '../api/errors';
import { useAuth } from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { API_BASE_URL } from '../config/env';
import { colors } from '../theme/tokens';
import { typography } from '../theme/typography';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { AppButton } from '../components/common/AppButton';
import { AppCard } from '../components/common/AppCard';
import { InputField } from '../components/common/InputField';
import { FormModal } from '../components/common/FormModal';
import { useToast } from '../components/common/ToastProvider';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { getPasswordValidationMessage } from '../utils/password';
import type { TenantResponseDTO, UserResponseDTO, UserRole, UserStatus } from '../types/api';

const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: 'Actif',
  SUSPENDED: 'Suspendu',
  BLOCKED: 'Bloqué',
  REVOKED: 'Révoqué',
};

const USER_STATUS_COLORS: Record<UserStatus, string> = {
  ACTIVE: colors.success600,
  SUSPENDED: colors.warning600,
  BLOCKED: colors.danger500,
  REVOKED: colors.neutral500,
};

const USER_ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Admin',
  EMPLOYE: 'Employe',
};

function resolveLogoUri(url?: string): string | undefined {
  if (!url) {
    return undefined;
  }
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  return `${API_BASE_URL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
}

function guessMimeType(fileName: string): string {
  const normalized = fileName.toLowerCase();
  if (normalized.endsWith('.png')) {
    return 'image/png';
  }
  if (normalized.endsWith('.webp')) {
    return 'image/webp';
  }
  return 'image/jpeg';
}

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
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [deletingLogo, setDeletingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [storeName, setStoreName] = useState('');
  const [currency, setCurrency] = useState('XAF');
  const [commerceSettingsId, setCommerceSettingsId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | undefined>();
  const [tenant, setTenant] = useState<TenantResponseDTO | null>(null);
  const [tenantUsers, setTenantUsers] = useState<UserResponseDTO[]>([]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

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

      const latestSettings = settings.length > 0 ? settings[settings.length - 1] : null;
      setCommerceSettingsId(latestSettings?.id ?? null);
      setLogoUrl(latestSettings?.logoUrl);

      // Source d'autorité du nom : Tenant.name (saisi à l'inscription).
      // CommerceSettings.nom devient un fallback legacy.
      if (fetchedTenant?.name?.trim()) {
        setStoreName(fetchedTenant.name);
      } else if (latestSettings?.nom?.trim()) {
        setStoreName(latestSettings.nom);
      }
      // Devise reste portée par CommerceSettings (entité dédiée aux préférences UI)
      if (latestSettings?.devise?.trim()) {
        setCurrency(latestSettings.devise);
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
      const settingsPayload = {
        nom: trimmedName,
        devise: normalizedCurrency,
        facturePDFActive: true,
      };
      const savedSettings = commerceSettingsId
        ? await updateCommerceSettings(commerceSettingsId, settingsPayload)
        : await createCommerceSettings(settingsPayload);
      setCommerceSettingsId(savedSettings.id);
      setLogoUrl(savedSettings.logoUrl);

      // 3. Propage la nouvelle devise/nom à toute l'app (TopBar, Dashboard, etc.)
      await refreshAppSettings();

      toast.success('Parametres enregistres.');
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
    const currentRole: UserRole = user.role === 'ADMIN' ? 'ADMIN' : 'EMPLOYE';
    const roleTransitions = [
      { label: 'Passer admin', role: 'ADMIN' },
      { label: 'Passer employe', role: 'EMPLOYE' },
    ] satisfies Array<{ label: string; role: UserRole }>;
    const availableRoleTransitions = roleTransitions.filter((t) => t.role !== currentRole);

    Alert.alert(
      user.name ?? user.email,
      `Statut actuel : ${USER_STATUS_LABELS[currentStatus]}\nRole actuel : ${USER_ROLE_LABELS[currentRole]}`,
      [
        ...available.map((t) => ({
          text: t.label,
          style: t.destructive ? ('destructive' as const) : ('default' as const),
          onPress: () => confirmStatusChange(user, t.status),
        })),
        ...availableRoleTransitions.map((t) => ({
          text: t.label,
          style: 'default' as const,
          onPress: () => confirmRoleChange(user, t.role),
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
      toast.success(`${user.name ?? user.email} est maintenant ${USER_STATUS_LABELS[newStatus]}.`);
      await loadSettings(false);
    } catch (statusError) {
      Alert.alert('Erreur', getErrorMessage(statusError));
    }
  };

  const confirmRoleChange = (user: UserResponseDTO, newRole: UserRole) => {
    Alert.alert(
      'Changer le role',
      `Passer ${user.name ?? user.email} en role ${newRole} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: () => {
            void applyRoleChange(user, newRole);
          },
        },
      ],
    );
  };

  const applyRoleChange = async (user: UserResponseDTO, newRole: UserRole) => {
    if (!user.id) {
      return;
    }
    try {
      await updateUserRole(user.id, newRole);
      toast.success(`${user.name ?? user.email} est maintenant ${newRole}.`);
      await loadSettings(false);
    } catch (roleError) {
      Alert.alert('Erreur', getErrorMessage(roleError));
    }
  };

  const resetPasswordModal = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordModal(false);
  };

  const handleChangePassword = async () => {
    if (!currentPassword.trim()) {
      Alert.alert('Validation', 'Le mot de passe actuel est obligatoire.');
      return;
    }
    const passwordValidationMessage = getPasswordValidationMessage(newPassword);
    if (passwordValidationMessage) {
      Alert.alert('Validation', passwordValidationMessage);
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Validation', 'Les deux nouveaux mots de passe ne correspondent pas.');
      return;
    }

    setChangingPassword(true);
    try {
      await changeMyPassword({ currentPassword, newPassword });
      resetPasswordModal();
      toast.success('Mot de passe modifie.');
    } catch (passwordError) {
      Alert.alert('Erreur', getErrorMessage(passwordError));
    } finally {
      setChangingPassword(false);
    }
  };

  const ensureCommerceSettings = async (): Promise<string | null> => {
    if (commerceSettingsId) {
      return commerceSettingsId;
    }

    const createdSettings = await createCommerceSettings({
      nom: storeName.trim() || tenant?.name?.trim() || 'Ma boutique',
      devise: currency.trim().toUpperCase() || 'XAF',
      facturePDFActive: true,
    });
    setCommerceSettingsId(createdSettings.id);
    setLogoUrl(createdSettings.logoUrl);
    return createdSettings.id;
  };

  const handlePickLogo = async () => {
    setUploadingLogo(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission requise', 'Autorisez l acces aux photos pour choisir le logo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.85,
      });
      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const settingsId = await ensureCommerceSettings();
      if (!settingsId) {
        return;
      }

      const asset = result.assets[0];
      const fileName = asset.fileName ?? asset.uri.split('/').pop() ?? 'logo.jpg';
      const updatedSettings = await uploadCommerceLogo(settingsId, {
        uri: asset.uri,
        name: fileName,
        type: asset.mimeType ?? guessMimeType(fileName),
      });
      setLogoUrl(updatedSettings.logoUrl);
      await refreshAppSettings();
      toast.success('Logo mis a jour.');
    } catch (logoError) {
      Alert.alert('Erreur logo', getErrorMessage(logoError));
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleDeleteLogo = () => {
    if (!commerceSettingsId || !logoUrl) {
      return;
    }

    Alert.alert('Supprimer le logo', 'Retirer le logo de la boutique ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          setDeletingLogo(true);
          try {
            const updatedSettings = await deleteCommerceLogo(commerceSettingsId);
            setLogoUrl(updatedSettings.logoUrl);
            await refreshAppSettings();
            toast.success('Logo supprime.');
          } catch (logoError) {
            Alert.alert('Erreur logo', getErrorMessage(logoError));
          } finally {
            setDeletingLogo(false);
          }
        },
      },
    ]);
  };

  const handleSendVerification = async () => {
    if (!session?.email) {
      toast.info('Aucun email de session disponible.');
      return;
    }

    setSendingVerification(true);
    try {
      await requestEmailVerification({ email: session.email });
      toast.info('Si le compte en a besoin, un email de verification a ete envoye.', 'Verification email');
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

  const resolvedLogoUri = resolveLogoUri(logoUrl);

  return (
    <>
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

        <View style={styles.logoBox}>
          {resolvedLogoUri ? (
            <Image source={{ uri: resolvedLogoUri }} style={styles.logoPreview} resizeMode='contain' />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Feather name='image' size={20} color={colors.neutral500} />
              <Text style={styles.note}>Aucun logo</Text>
            </View>
          )}
          <View style={styles.logoActions}>
            <AppButton
              label={logoUrl ? 'Changer le logo' : 'Ajouter un logo'}
              variant='outline'
              onPress={() => {
                void handlePickLogo();
              }}
              loading={uploadingLogo}
            />
            {logoUrl ? (
              <AppButton
                label='Supprimer'
                variant='ghost'
                onPress={handleDeleteLogo}
                loading={deletingLogo}
              />
            ) : null}
          </View>
        </View>

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
          label='Changer le mot de passe'
          variant='outline'
          onPress={() => setShowPasswordModal(true)}
        />

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

    <FormModal
      visible={showPasswordModal}
      title='Changer le mot de passe'
      onClose={resetPasswordModal}
    >
      <InputField
        label='Mot de passe actuel'
        value={currentPassword}
        onChangeText={setCurrentPassword}
        secureTextEntry
        textContentType='password'
        autoCapitalize='none'
      />
      <InputField
        label='Nouveau mot de passe'
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        textContentType='newPassword'
        autoCapitalize='none'
      />
      <InputField
        label='Confirmer le mot de passe'
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        textContentType='newPassword'
        autoCapitalize='none'
      />
      <View style={styles.actionRow}>
        <View style={styles.actionItem}>
          <AppButton
            label='Retour'
            variant='outline'
            onPress={resetPasswordModal}
            disabled={changingPassword}
          />
        </View>
        <View style={styles.actionItem}>
          <AppButton
            label='Enregistrer'
            onPress={() => {
              void handleChangePassword();
            }}
            loading={changingPassword}
          />
        </View>
      </View>
    </FormModal>
    </>
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
  logoBox: {
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.neutral200,
    borderRadius: 8,
    backgroundColor: colors.neutral50,
  },
  logoPreview: {
    width: '100%',
    height: 96,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  logoPlaceholder: {
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.neutral300,
    backgroundColor: colors.white,
  },
  logoActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  actionItem: {
    flex: 1,
  },
});
