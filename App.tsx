import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, StatusBar, StyleSheet, View, useWindowDimensions } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { BottomNavigation } from './src/components/BottomNavigation';
import { SideNavigation } from './src/components/SideNavigation';
import { MoreDrawer } from './src/components/MoreDrawer';
import { MobileTopBar } from './src/components/MobileTopBar';
import { LoadingState } from './src/components/common/LoadingState';
import { DashboardScreen } from './src/screens/Dashboard';
import { VentesScreen } from './src/screens/Ventes';
import { StocksScreen } from './src/screens/Stocks';
import { ClientsScreen } from './src/screens/Clients';
import { ParametresScreen } from './src/screens/Parametres';
import { NouvelleVenteScreen } from './src/screens/NouvelleVente';
import { FournisseursScreen } from './src/screens/Fournisseurs';
import { CategoriesScreen } from './src/screens/Categories';
import { FacturesScreen } from './src/screens/Factures';
import { InvitationsScreen } from './src/screens/Invitations';
import { LoginScreen } from './src/screens/auth/Login';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { colors } from './src/theme/tokens';
import { type NavigationTab } from './src/navigation/tabs';
import { listCommerceSettings } from './src/api/services';

const AUTO_REFRESH_TABS: NavigationTab[] = ['dashboard', 'ventes', 'stocks', 'factures'];
const AUTO_REFRESH_INTERVAL_MS = 3600_000;

function AppShell() {
  const { session, isBooting, logout } = useAuth();
  const { width } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [showNewSale, setShowNewSale] = useState(false);
  const [showMoreDrawer, setShowMoreDrawer] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [shopName, setShopName] = useState('Ma boutique');
  const appStateRef = useRef(AppState.currentState);

  const bumpRefresh = useCallback(() => {
    setRefreshSignal((value) => value + 1);
  }, []);

  const isAutoRefreshEnabled = Boolean(
    session && !showNewSale && AUTO_REFRESH_TABS.includes(activeTab),
  );

  useEffect(() => {
    let mounted = true;

    if (!session) {
      setShopName('Ma boutique');
      return () => {
        mounted = false;
      };
    }

    (async () => {
      try {
        const settings = await listCommerceSettings();
        const resolvedName = settings[0]?.nom?.trim();
        if (mounted) {
          setShopName(resolvedName && resolvedName.length > 0 ? resolvedName : 'Ma boutique');
        }
      } catch {
        if (mounted) {
          setShopName('Ma boutique');
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [refreshSignal, session]);

  useEffect(() => {
    if (!isAutoRefreshEnabled) {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (
        (previousState === 'inactive' || previousState === 'background') &&
        nextState === 'active'
      ) {
        bumpRefresh();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [bumpRefresh, isAutoRefreshEnabled]);

  useEffect(() => {
    if (!isAutoRefreshEnabled) {
      return;
    }

    const timer = setInterval(() => {
      if (AppState.currentState === 'active') {
        bumpRefresh();
      }
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(timer);
    };
  }, [bumpRefresh, isAutoRefreshEnabled]);

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
      case 'fournisseurs':
        return <FournisseursScreen refreshSignal={refreshSignal} />;
      case 'categories':
        return <CategoriesScreen refreshSignal={refreshSignal} />;
      case 'factures':
        return <FacturesScreen refreshSignal={refreshSignal} />;
      case 'invitations':
        return <InvitationsScreen refreshSignal={refreshSignal} />;
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
      <StatusBar barStyle='dark-content' translucent={false} />
      <ExpoStatusBar style='dark' />

      {isDesktopLayout ? (
        <View style={styles.desktopShell}>
          <SideNavigation activeTab={activeTab} onTabChange={setActiveTab} onLogout={() => void logout()} />
          <View style={styles.desktopContent}>{content}</View>
        </View>
      ) : (
        <>
          {session && !showNewSale ? (
            <MobileTopBar
              activeTab={activeTab}
              onOpenDrawer={() => {
                setShowMoreDrawer(true);
              }}
            />
          ) : null}
          <View style={styles.container}>{content}</View>
          {session && !showNewSale && (
            <View style={styles.bottomBar}>
              <BottomNavigation
                activeTab={activeTab}
                onTabChange={(tab) => {
                  setShowMoreDrawer(false);
                  setActiveTab(tab);
                }}
              />
            </View>
          )}
          {session && !showNewSale ? (
            <MoreDrawer
              visible={showMoreDrawer}
              activeTab={activeTab}
              shopName={shopName}
              onClose={() => setShowMoreDrawer(false)}
              onSelectTab={(tab) => {
                setActiveTab(tab);
              }}
              onLogout={() => {
                setShowMoreDrawer(false);
                void logout();
              }}
            />
          ) : null}
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

  return (
    <SafeAreaProvider>
      {!fontsLoaded && !fontError ? (
        <SafeAreaView style={styles.safeArea}>
          <LoadingState message='Chargement de l interface...' />
        </SafeAreaView>
      ) : (
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      )}
    </SafeAreaProvider>
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
