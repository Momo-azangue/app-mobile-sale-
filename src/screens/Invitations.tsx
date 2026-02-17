import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { inviteUserToTenant } from '../api/services';
import { getErrorMessage } from '../api/errors';
import type { InvitationRole } from '../types/api';
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
import { ScreenHeader } from '../components/common/ScreenHeader';
import { SegmentedControl, type SegmentedOption } from '../components/common/SegmentedControl';

interface InvitationsScreenProps {
  refreshSignal: number;
}

interface LocalInvitationEntry {
  id: string;
  email: string;
  role: InvitationRole;
  createdAt: string;
}

export function InvitationsScreen({ refreshSignal }: InvitationsScreenProps) {
  void refreshSignal;
  const { session } = useAuth();

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitationRole>('EMPLOYE');
  const [sentInvitations, setSentInvitations] = useState<LocalInvitationEntry[]>([]);

  const roleOptions = useMemo<SegmentedOption[]>(
    () => [
      { label: 'Employe', value: 'EMPLOYE' },
      { label: 'Admin', value: 'ADMIN' },
    ],
    []
  );

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

      setSentInvitations((current) => [
        {
          id: `${Date.now()}`,
          email: email.trim(),
          role,
          createdAt: new Date().toISOString(),
        },
        ...current,
      ]);

      closeCreateModal();
      Alert.alert('Succes', 'Invitation envoyee.');
    } catch (saveError) {
      Alert.alert('Erreur', getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <ScreenHeader title='Invitations' subtitle='Inviter des utilisateurs dans la boutique' />

        <AppCard style={styles.infoCard}>
          <Text style={styles.infoText}>
            Cette API envoie les invitations par email. L historique distant n est pas encore expose par le backend.
          </Text>
        </AppCard>

        {sentInvitations.length === 0 ? (
          <EmptyState
            icon='user-plus'
            title='Aucune invitation envoyee'
            description='Envoyez une invitation pour ajouter un nouvel utilisateur.'
            actionLabel='Inviter'
            onAction={() => setShowInviteForm(true)}
          />
        ) : (
          <View style={styles.list}>
            {sentInvitations.map((invitation) => (
              <AppCard key={invitation.id} style={styles.invitationCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.invitationEmail}>{invitation.email}</Text>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>{invitation.role}</Text>
                  </View>
                </View>
                <Text style={styles.invitationMeta}>
                  Envoyee le {new Date(invitation.createdAt).toLocaleString()}
                </Text>
              </AppCard>
            ))}
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
  infoCard: {
    marginBottom: 12,
  },
  infoText: {
    ...typography.label,
    color: colors.neutral600,
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
  roleBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.primary100,
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
