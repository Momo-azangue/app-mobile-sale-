import type { ComponentProps } from 'react';
import { Feather } from '@expo/vector-icons';

export type NavigationTab =
  | 'dashboard'
  | 'ventes'
  | 'stocks'
  | 'clients'
  | 'fournisseurs'
  | 'categories'
  | 'factures'
  | 'invitations'
  | 'parametres';

export interface NavigationItem {
  id: NavigationTab;
  label: string;
  icon: ComponentProps<typeof Feather>['name'];
}

export const MOBILE_PRIMARY_TABS: NavigationItem[] = [
  { id: 'dashboard', label: 'Tableau', icon: 'home' },
  { id: 'ventes', label: 'Ventes', icon: 'shopping-cart' },
  { id: 'stocks', label: 'Stocks', icon: 'package' },
  { id: 'clients', label: 'Clients', icon: 'users' },
];

export const SECONDARY_TABS: NavigationItem[] = [
  { id: 'fournisseurs', label: 'Fournisseurs', icon: 'truck' },
  { id: 'categories', label: 'Categories', icon: 'tag' },
  { id: 'factures', label: 'Factures', icon: 'file-text' },
  { id: 'invitations', label: 'Invitations', icon: 'user-plus' },
  { id: 'parametres', label: 'Parametres', icon: 'settings' },
];

export const DESKTOP_TABS: NavigationItem[] = [...MOBILE_PRIMARY_TABS, ...SECONDARY_TABS];
const ALL_TABS: NavigationItem[] = [...DESKTOP_TABS];

export function isSecondaryTab(tab: NavigationTab): boolean {
  return SECONDARY_TABS.some((item) => item.id === tab);
}

export function getTabLabel(tab: NavigationTab): string {
  return ALL_TABS.find((item) => item.id === tab)?.label ?? 'Tableau';
}
