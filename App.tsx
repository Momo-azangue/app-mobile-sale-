import { useMemo, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

import { BottomNavigation } from './src/components/BottomNavigation';
import { DashboardScreen } from './src/screens/Dashboard';
import { VentesScreen } from './src/screens/Ventes';
import { StocksScreen } from './src/screens/Stocks';
import { ClientsScreen } from './src/screens/Clients';
import { ParametresScreen } from './src/screens/Parametres';
import { NouvelleVenteScreen } from './src/screens/NouvelleVente';
import { LoginScreen } from './src/screens/auth/Login';
import { AuthProvider, useAuth } from './src/context/AuthContext';

type TabKey = 'dashboard' | 'ventes' | 'stocks' | 'clients' | 'parametres';

function AppShell() {
  const { session, isBooting, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [showNewSale, setShowNewSale] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);

  const bumpRefresh = () => setRefreshSignal((value) => value + 1);

  const content = useMemo(() => {
    if (!session) {
      return <LoginScreen />;
    }

    if (showNewSale) {
      return (
        <NouvelleVenteScreen
          refreshSignal={refreshSignal}
          onCreated={bumpRefresh}
          onBack={() => {
            setShowNewSale(false);
            setActiveTab('ventes');
          }}
        />
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return <DashboardScreen refreshSignal={refreshSignal} />;
      case 'ventes':
        return <VentesScreen refreshSignal={refreshSignal} onCreateNew={() => setShowNewSale(true)} />;
      case 'stocks':
        return <StocksScreen refreshSignal={refreshSignal} />;
      case 'clients':
        return <ClientsScreen refreshSignal={refreshSignal} onClientChanged={bumpRefresh} />;
      case 'parametres':
        return (
          <ParametresScreen
            refreshSignal={refreshSignal}
            onSettingsChanged={bumpRefresh}
            onLogout={logout}
          />
        );
      default:
        return <DashboardScreen refreshSignal={refreshSignal} />;
    }
  }, [activeTab, logout, refreshSignal, session, showNewSale]);

  if (isBooting) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.bootContainer}>
          <ActivityIndicator color='#4338CA' />
          <Text style={styles.bootText}>Initialisation session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle='dark-content' />
      <ExpoStatusBar style='dark' />
      <View style={styles.container}>{content}</View>
      {session && !showNewSale && (
        <View style={styles.bottomBar}>
          <BottomNavigation activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab as TabKey)} />
        </View>
      )}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  bootContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  bootText: {
    color: '#6B7280',
  },
});
