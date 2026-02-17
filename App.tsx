import { useMemo, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, View, useWindowDimensions } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';

import { BottomNavigation } from './src/components/BottomNavigation';
import { SideNavigation, type NavigationTab } from './src/components/SideNavigation';
import { LoadingState } from './src/components/common/LoadingState';
import { DashboardScreen } from './src/screens/Dashboard';
import { VentesScreen } from './src/screens/Ventes';
import { StocksScreen } from './src/screens/Stocks';
import { ClientsScreen } from './src/screens/Clients';
import { ParametresScreen } from './src/screens/Parametres';
import { NouvelleVenteScreen } from './src/screens/NouvelleVente';
import { LoginScreen } from './src/screens/auth/Login';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { colors } from './src/theme/tokens';

function AppShell() {
  const { session, isBooting, logout } = useAuth();
  const { width } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
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
        <LoadingState message='Initialisation session...' />
      </SafeAreaView>
    );
  }

  const isDesktopLayout = Boolean(session) && width >= 1024 && !showNewSale;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle='dark-content' />
      <ExpoStatusBar style='dark' />

      {isDesktopLayout ? (
        <View style={styles.desktopShell}>
          <SideNavigation activeTab={activeTab} onTabChange={setActiveTab} onLogout={() => void logout()} />
          <View style={styles.desktopContent}>{content}</View>
        </View>
      ) : (
        <>
          <View style={styles.container}>{content}</View>
          {session && !showNewSale && (
            <View style={styles.bottomBar}>
              <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded && !fontError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingState message='Chargement de l interface...' />
      </SafeAreaView>
    );
  }

  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.neutral50,
  },
  container: {
    flex: 1,
  },
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral200,
  },
  desktopShell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.neutral50,
  },
  desktopContent: {
    flex: 1,
  },
});
