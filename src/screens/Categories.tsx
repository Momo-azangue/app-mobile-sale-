import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { createCategory, deleteCategory, listCategories } from '../api/services';
import { getErrorMessage } from '../api/errors';
import type { CategoryResponseDTO } from '../types/api';
import { colors } from '../theme/tokens';
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
import { SearchField } from '../components/common/SearchField';

interface CategoriesScreenProps {
  refreshSignal: number;
}

export function CategoriesScreen({ refreshSignal }: CategoriesScreenProps) {
  const [categories, setCategories] = useState<CategoryResponseDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetched = await listCategories();
      setCategories(fetched);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories, refreshSignal]);

  const filteredCategories = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return categories.filter((category) => {
      const blob = `${category.nom} ${category.description ?? ''}`.toLowerCase();
      return blob.includes(lower);
    });
  }, [categories, searchTerm]);

  const resetForm = () => {
    setName('');
    setDescription('');
  };

  const closeCreateModal = () => {
    setShowCreateForm(false);
    resetForm();
  };

  const handleCreateCategory = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Le nom de categorie est obligatoire.');
      return;
    }

    setSaving(true);
    try {
      await createCategory({
        nom: name.trim(),
        description: description.trim() || undefined,
      });

      closeCreateModal();
      await loadCategories();
    } catch (saveError) {
      Alert.alert('Erreur', getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = (category: CategoryResponseDTO) => {
    Alert.alert('Supprimer categorie', `Supprimer ${category.nom} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCategory(category.id);
            await loadCategories();
          } catch (deleteError) {
            Alert.alert('Erreur', getErrorMessage(deleteError));
          }
        },
      },
    ]);
  };

  if (loading) {
    return <LoadingState message='Chargement categories...' />;
  }

  if (error) {
    return <ErrorState title='Erreur categories' message={error} onRetry={() => void loadCategories()} />;
  }

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <ScreenHeader title='Categories' subtitle='Classification de votre catalogue produit' />

        <SearchField
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder='Rechercher une categorie...'
        />

        {filteredCategories.length === 0 ? (
          <EmptyState
            icon='tag'
            title='Aucune categorie'
            description='Ajoutez des categories pour organiser les produits.'
            actionLabel='Ajouter'
            onAction={() => setShowCreateForm(true)}
          />
        ) : (
          <View style={styles.list}>
            {filteredCategories.map((category) => (
              <AppCard key={category.id} style={styles.categoryCard}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryName}>{category.nom}</Text>
                  <Pressable onPress={() => handleDeleteCategory(category)}>
                    <Feather name='trash-2' size={18} color={colors.danger600} />
                  </Pressable>
                </View>

                <Text style={styles.categoryDescription}>{category.description || 'Sans description'}</Text>
              </AppCard>
            ))}
          </View>
        )}
      </ScrollView>

      <FloatingActionButton
        accessibilityLabel='Ajouter une categorie'
        onPress={() => setShowCreateForm(true)}
      />

      <FormModal
        visible={showCreateForm}
        title='Nouvelle categorie'
        onClose={closeCreateModal}
      >
        <InputField
          label='Nom'
          value={name}
          onChangeText={setName}
          placeholder='Nom de la categorie'
        />
        <InputField
          label='Description (optionnel)'
          value={description}
          onChangeText={setDescription}
          placeholder='Description'
          multiline
        />

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
              label={saving ? 'Ajout...' : 'Ajouter'}
              onPress={() => {
                void handleCreateCategory();
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
    marginTop: 16,
    gap: 12,
  },
  categoryCard: {
    gap: 8,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryName: {
    ...typography.bodyMedium,
    color: colors.neutral900,
  },
  categoryDescription: {
    ...typography.label,
    color: colors.neutral600,
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
