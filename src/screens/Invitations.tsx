import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { inviteUserToTenant, listInvitations } from '../api/services';
import { getErrorMessage } from '../api/errors';
import type { InvitationResponseDTO, InvitationRole, InvitationStatus } from '../types/api';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme/tokens';
import { typography } from '../theme/typography';
import { AppButton } from '../components/common/AppButton';
import { AppCard } from '../components/common/AppCard';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { FloatingActionButton } from '../components/common/FloatingActionButton';
import { FormModal } from '../components/common/FormModal';
import { InputField } from '../components/common/InputField';
import { LoadingState } from '../components/common/LoadingState';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { SegmentedControl, type SegmentedOption } from '../components/common/SegmentedControl';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

interface InvitationsScreenProps {
  refreshSignal: number;
}

const statusMeta: Record<InvitationStatus, { label: string; text: string; bg: string }> = {
  PENDING: { label: 'En attente', text: colors.warning600, bg: colors.warning100 },
  ACCEPTED: { label: 'Acceptee', text: colors.success600, bg: colors.success100 },
  EXPIRED: { label: 'Expiree', text: colors.danger600, bg: colors.danger100 },
};

export function InvitationsScreen({ refreshSignal }: InvitationsScreenProps) {
  const { session } = useAuth();

  const [invitations, setInvitations] = useState<InvitationResponseDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitationRole>('EMPLOYE');

  const roleOptions = useMemo<SegmentedOption[]>(
    () => [
      { label: 'Employe', value: 'EMPLOYE' },
      { label: 'Admin', value: 'ADMIN' },
    ],
    []
  );

  const loadInvitations = useCallback(async (showLoader: boolean = true) => {
    if (showLoader) {
      setLoading(true);
    }
    setError(null);
    try {
      const fetched = await listInvitations();
      setInvitations(fetched);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session?.tenantId) {
      return;
    }
    void loadInvitations(true);
  }, [loadInvitations, refreshSignal, session?.tenantId]);
  const { refreshing, onRefresh } = usePullToRefresh(() => loadInvitations(false));

  if (!session?.tenantId) {
    return (
      <ErrorState
        title='Session invalide'
        message='Tenant introuvable dans la session. Reconnectez-vous puis recommencez.'
      />
    );
  }

  const resetForm = () => {
    setEmail('');
    setRole('EMPLOYE');
  };

  const closeCreateModal = () => {
    setShowInviteForm(false);
    resetForm();
  };

  const handleSendInvitation = async () => {
    if (!email.trim()) {
      Alert.alert('Validation', 'L email est obligatoire.');
      return;
    }

    setSaving(true);
    try {
      await inviteUserToTenant(session.tenantId, {
        email: email.trim(),
        role,
      });

      closeCreateModal();
      await loadInvitations();
      Alert.alert('Succes', 'Invitation envoyee.');
    } catch (saveError) {
      Alert.alert('Erreur', getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState message='Chargement invitations...' />;
  }

  if (error) {
    return <ErrorState title='Erreur invitations' message={error} onRetry={() => void loadInvitations()} />;
  }

  return (
    <View style={styles.wrapper}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary600} />
        }
      >
        <ScreenHeader title='Invitations' subtitle='Inviter et suivre les utilisateurs de la boutique' />

        {invitations.length === 0 ? (
          <EmptyState
            icon='user-plus'
            title='Aucune invitation'
            description='Envoyez une invitation pour ajouter un nouvel utilisateur.'
            actionLabel='Inviter'
            onAction={() => setShowInviteForm(true)}
          />
        ) : (
          <View style={styles.list}>
            {invitations.map((invitation) => {
              const meta = statusMeta[invitation.status] ?? statusMeta.PENDING;
              return (
                <AppCard key={invitation.id} style={styles.invitationCard}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.invitationEmail}>{invitation.email}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: meta.text }]}>{meta.label}</Text>
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    <Text style={styles.roleBadgeText}>{invitation.role}</Text>
                    <Text style={styles.invitationMeta}>
                      Envoyee le {invitation.createdAt ? new Date(invitation.createdAt).toLocaleString() : '-'}
                    </Text>
                  </View>
                </AppCard>
              );
            })}
          </View>
        )}
      </ScrollView>

      <FloatingActionButton
        accessibilityLabel='Envoyer une invitation'
        onPress={() => setShowInviteForm(true)}
      />

      <FormModal
        visible={showInviteForm}
        title='Inviter un utilisateur'
        onClose={closeCreateModal}
      >
        <InputField
          label='Email'
          value={email}
          onChangeText={setEmail}
          placeholder='utilisateur@domaine.com'
          autoCapitalize='none'
          keyboardType='email-address'
        />

        <View style={styles.roleSection}>
          <Text style={styles.roleLabel}>Role</Text>
          <SegmentedControl
            options={roleOptions}
            value={role}
            onChange={(value) => setRole(value as InvitationRole)}
          />
        </View>

        <View style={styles.actionRow}>
          <View style={styles.actionItem}>
            <AppButton
              label='Retour'
              variant='outline'
              onPress={closeCreateModal}
              disabled={saving}
            />
          </View>
          <View style={styles.actionItem}>
            <AppButton
              label={saving ? 'Envoi...' : 'Envoyer'}
              onPress={() => {
                void handleSendInvitation();
              }}
              disabled={saving}
            />
          </View>
        </View>
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: colors.neutral50,
  },
  container: {
    flex: 1,
    backgroundColor: colors.neutral50,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 120,
  },
  list: {
    marginTop: 8,
    gap: 12,
  },
  invitationCard: {
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  invitationEmail: {
    flex: 1,
    ...typography.bodyMedium,
    color: colors.neutral900,
  },
  statusBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    ...typography.captionMedium,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  roleBadgeText: {
    ...typography.captionMedium,
    color: colors.primary600,
  },
  invitationMeta: {
    ...typography.caption,
    color: colors.neutral500,
  },
  roleSection: {
    gap: 8,
    marginTop: 2,
  },
  roleLabel: {
    ...typography.label,
    color: colors.neutral700,
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
