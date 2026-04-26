# Sales-app-mobile — Contexte projet

Application mobile **Expo / React Native** (TypeScript) qui consomme l'API **SalesBackend** (dossier voisin). Cible : Android / iOS / Web (multi-plateforme via `react-native-web`).

## Stack
- **Expo SDK 54**, React Native 0.81, React 19
- **TypeScript strict** (`tsconfig.json` étend `expo/tsconfig.base` + `strict: true`)
- **axios** pour HTTP (deux instances : `api` authentifiée, `publicApi` non auth)
- **@react-native-async-storage/async-storage** pour persistance locale
- **@expo-google-fonts/inter** (Inter 400/500/600/700)
- **react-native-safe-area-context**
- **expo-file-system + expo-sharing** (téléchargement/partage PDF factures)
- **Pas** de React Navigation : navigation maison via `useState<NavigationTab>` dans `App.tsx`
- **Pas** de React Query / SWR : refresh manuel via un compteur `refreshSignal` propagé en prop

## Structure
```
src/
  api/          http.ts (axios + intercepteurs auth/refresh/retry), services.ts (endpoints typés),
                storage.ts (session AsyncStorage), cache.ts (cache liste fallback offline), errors.ts
  components/   BottomNavigation, MobileTopBar, MoreDrawer, SideNavigation (≥1024px), common/
  config/       env.ts (API_BASE_URL)
  context/      AuthContext.tsx (session, login/logout/refresh, refresh dédupliqué via Ref)
  hooks/        usePullToRefresh.ts
  navigation/   tabs.ts (type NavigationTab)
  screens/      Dashboard, Ventes, Stocks, Clients, Fournisseurs, Categories, Factures,
                Invitations, Parametres, NouvelleVente, auth/Login
  theme/        tokens.ts (colors, spacing…), typography.ts
  types/        api.ts (DTOs miroir backend, SessionState, ErrorResponse)
  utils/        format.ts
App.tsx         AppShell + AuthProvider, gère responsive desktop (≥1024) vs mobile, auto-refresh
```

## Authentification
- Persistance session : `AsyncStorage` clé `sales.mobile.session.v1` (cf. `src/api/storage.ts:5`)
- `AuthProvider` (`src/context/AuthContext.tsx`) bind les tokens aux intercepteurs axios via `configureHttpAuth`
- **Refresh automatique** sur 401 dans `api.interceptors.response` (`src/api/http.ts:115`) — déduplication via `refreshPromiseRef` (un seul refresh en vol, les autres requêtes attendent)
- Endpoints publics utilisent `publicApi` (sans header Authorization), endpoints protégés utilisent `api`
- **Retry réseau** : 2 tentatives backoff exponentiel (350ms, 700ms) sur GET/HEAD/OPTIONS si 5xx ou réseau down

## ⚠️ Pièges et incohérences connus avec le backend

### Sécurité (à corriger)
- **Tokens dans AsyncStorage en clair** (`src/api/storage.ts`) — sur Android root / iOS jailbreak, lisible. Migrer vers **`expo-secure-store`** pour `accessToken` + `refreshToken`.
- **`usesCleartextTraffic: true`** dans `app.json:23` — autorise HTTP non chiffré sur Android. À désactiver en build prod.
- **`API_BASE_URL` fallback hardcodée à une IP LAN** (`src/config/env.ts:1` : `http://192.168.1.68:8080`) — doit être surchargée par `EXPO_PUBLIC_API_BASE_URL` en build, mais le fallback ne devrait pas être en clair dans le repo.

### Mismatches contrat API ↔ backend (✅ corrigés Phase 1)
- ✅ Header `X-Tenant-Id` supprimé de `http.ts` (le backend lit le claim JWT). Aussi retiré du download PDF natif dans `Factures.tsx`.
- ✅ `ErrorResponse` aligné sur RFC 7807 (`type, title, status, detail, instance, timestamp`).
- ✅ `getErrorMessage()` lit maintenant `data.detail` puis `data.title`.
- ✅ `listInvoices/listSales/listProducts` consomment maintenant `PagedResponse<T>` (et retournent `.content`). Variantes `*Page(page, size)` ajoutées pour la vraie pagination. Taille par défaut : `DEFAULT_BULK_PAGE_SIZE = 200`.
- ✅ `AuthContext.logout()` appelle `POST /api/v1/auth/logout` avant de clear le storage (révocation refresh token côté serveur).

### Phase 3 — câblage UI (✅ partiel)
- ✅ `ParametresScreen` : nouvelles sections **Mon abonnement** (`getMyTenant`) et **Mes employés** (`listMyTenantUsers`). Chargement parallèle, tolérant aux erreurs (catch silencieux pour ne pas bloquer le reste).
- ⏸️ **TODO Phase 3 v2 — Pagination réelle** : `Ventes`, `Factures`, `Produits` chargent encore tout via `DEFAULT_BULK_PAGE_SIZE=200`. Refactor en `FlatList` + scroll infini avec `listSalesPage/listInvoicesPage/listProductsPage` quand une boutique dépasse 200 items.
- ⏸️ **TODO Phase 3 v2 — Détail produit** : créer un écran de détail produit qui utilise `listStockMovementsByProduct(productId)` pour l'historique.
- ⏸️ **TODO Phase 3 v2 — Preview PDF** : `previewInvoicePdf(saleId)` exposé dans `services.ts` mais pas encore branché côté UI (utile avant `downloadInvoicePdf` pour visualiser sans sauvegarder).
- ⏸️ **TODO Phase 3 v2 — Change plan** : `changeMyTenantPlan(planId)` dispo, à brancher sur un sélecteur de plan dans Paramètres.

### Vague A — Variantes produit (✅ CLÔTURÉE)
- ✅ `Product` enrichi : `brand`, `trackingMode: 'NONE' | 'SERIAL'`. Une variante par défaut est auto-créée à chaque `createProduct` côté backend.
- ✅ Entité `ProductVariant` côté backend, exposée via `/api/v1/products/{productId}/variants` (CRUD complet). Services TS : `listProductVariants`, `getProductVariant`, `createProductVariant`, `updateProductVariant`, `deleteProductVariant`.
- ✅ `Sale` / `StockMovement` / `InvoiceLine` portent un `variantId` (résolu en default si non fourni). Pas de breaking change : tout endpoint existant continue de marcher sans rien envoyer.
- ✅ `StocksScreen` : modal produit expose les champs **Marque** (libre, optionnel) et **Type de produit** (segmented `Standard` / `Avec n° de série`).
- ✅ `StocksScreen` : section **Variantes** inline dans le modal d'édition (visible uniquement quand on édite un produit existant, pas à la création). Liste des variantes nommées + mini-form d'ajout (nom, prix optionnel, stock initial) + suppression. La variante par défaut (name=null) reste invisible.
- ✅ `NouvelleVente` : picker variante affiché conditionnellement. Quand un produit est sélectionné, charge à la demande ses variantes nommées. Si ≥ 1 → affiche le picker. Sinon → caché et le backend résout la default. Le `variantId` est inclus dans le payload de la vente.

### Vague B — Sérialisation IMEI (à venir)

Bénéfice clé pour le client électronique. Préparé par : `Product.trackingMode = 'SERIAL'`, `variantId` partout, conventions de stock.

**Préférences UX validées avec l'utilisateur (à respecter quand on codera la Vague B) :**
- **Saisie IMEI = champ texte avec bouton scan caméra à côté**, pas de modal séparé. Le commerçant peut soit :
  - taper l'IMEI au clavier (utile s'il a un scanner USB Bluetooth qui agit comme clavier, ou pour saisie manuelle au cas par cas)
  - cliquer le bouton à côté pour ouvrir la caméra et scanner le code-barres / QR code
- Le choix appartient au commerçant à chaque saisie (pas un paramètre global)
- Composant à créer : `<ImeiInput value onChange />` qui encapsule cette logique
- Lib à utiliser : `expo-camera` (préféré à `expo-barcode-scanner` qui est déprécié dans Expo SDK 50+)

**À venir backend :** entité `ProductUnit` (id, productId, variantId, serialNumber, status, providerId, origin, purchaseDate, soldDate, saleId, clientId, warrantyEndsAt), endpoints CRUD + scan, validation que la vente d'un produit `SERIAL` exige une liste d'IMEI sortis, propagation IMEI dans `InvoiceLine` pour la facture PDF.

## Patterns observés (à respecter)
- **Refresh des écrans** : passer la prop `refreshSignal: number` (compteur incrémenté par `bumpRefresh` dans `App.tsx`). Les écrans déclenchent un `useEffect` sur ce signal pour re-fetch.
- **Auto-refresh** : sur foreground (AppState `active`) + interval 1h, uniquement pour `dashboard | ventes | stocks | factures` (cf. `App.tsx:34`).
- **Cache offline** : utiliser `cachedList(key, fetcher)` de `src/api/cache.ts` quand on veut un fallback en cas d'échec réseau (renvoie la dernière liste connue).
- **DTOs typés** : ajouter le type dans `src/types/api.ts`, l'exposer en mirror exact du DTO backend (camelCase).
- **Endpoints** : ajouter les nouveaux dans `src/api/services.ts`, jamais d'appel `axios.get/post` direct depuis un screen.
- **Theming** : utiliser `colors`, `spacing`, etc. depuis `src/theme/tokens.ts`. Pas de couleurs en dur.
- **Texts** : interface en **français** (textes UI, labels, messages d'erreur). Garder cette cohérence.
- **Layout responsive** : `width >= 1024` → desktop (SideNavigation à gauche), sinon mobile (BottomNavigation + MobileTopBar + MoreDrawer pour les onglets secondaires).
- **Chargement** : `LoadingState` depuis `components/common`. Toujours gérer les 3 états : booting / data / error.

## Commandes
```bash
npm start              # expo start
npm run android        # expo start --android
npm run ios            # expo start --ios
npm run web            # expo start --web (utile pour tests rapides UI)
npx tsc --noEmit       # typecheck (pas de script npm dédié)
```
**Pas de tests** dans le projet à ce jour — pas de `jest`, pas de `@testing-library/react-native`. À proposer si on touche à un flow critique (auth, paiement, vente).

## Variables d'environnement (Expo)
- `EXPO_PUBLIC_API_BASE_URL` — URL du backend (ex: `https://api.example.com`). Sinon fallback hardcodé à `http://192.168.1.68:8080`.
- Préfixer `EXPO_PUBLIC_*` pour que les vars soient injectées côté client.

## Quand on me demande une feature ou un fix
1. **DTO backend** : vérifier `SalesBackend/CLAUDE.md` puis le DTO réel côté Java pour aligner le type TS dans `types/api.ts`.
2. **Endpoint** : ajouter dans `services.ts`, jamais inline dans un screen.
3. **Auth** : si nouvel endpoint protégé, utiliser `api`. Si public (login/refresh/register/forgot/reset/verify-email/invitations/accept), utiliser `publicApi`.
4. **Erreurs** : utiliser `getErrorMessage(error)` (mais corriger d'abord le bug `message` vs `detail` si on touche aux erreurs).
5. **Refresh des données** : déclencher via `refreshSignal` ou `bumpRefresh()` plutôt qu'un fetch ad hoc.
6. **i18n** : tout texte UI en français.
7. **Sécurité** : ne jamais logger un token / mot de passe ; pour toute donnée sensible nouvelle, envisager `expo-secure-store`.
