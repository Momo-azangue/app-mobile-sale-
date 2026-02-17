# MVP Integration Matrix (Mobile -> Backend)

## Authentication

| Screen | Endpoint | Method | Request fields | Response fields used |
|---|---|---|---|---|
| Register | `/api/v1/users/register` | POST | `user{name,email,password,role}`, `tenant{name,planId,subscriptionEndDate,emailContact}` | `email`, `role` |
| Register helper | `/api/v1/plans` | GET | - | `id`, `name` |
| Login | `/api/v1/auth/login` | POST | `email`, `password` | `accessToken`, `refreshToken`, `tenantId`, `email`, `role`, `tokenType` |
| Session refresh (interceptor) | `/api/v1/auth/refresh` | POST | `refreshToken` | `accessToken`, optional `refreshToken`, `tenantId`, `email`, `role` |

## Dashboard

| Screen | Endpoint | Method | Request fields | Response fields used |
|---|---|---|---|---|
| Dashboard | `/api/v1/invoices` | GET | - | `montant`, `balanceDue`, `statut`, `saleDate`, `date` |
| Dashboard | `/api/v1/clients` | GET | - | list length |

## Clients

| Screen | Endpoint | Method | Request fields | Response fields used |
|---|---|---|---|---|
| Clients list | `/api/v1/clients` | GET | - | `id`, `name`, `email`, `phone` |
| Clients create | `/api/v1/clients` | POST | `name`, `email?`, `phone?` | `id`, `name`, `email`, `phone` |
| Clients delete | `/api/v1/clients/{id}` | DELETE | path `id` | no body |

## Stocks

| Screen | Endpoint | Method | Request fields | Response fields used |
|---|---|---|---|---|
| Stocks products | `/api/v1/products` | GET | - | `id`, `name`, `categoryName` |
| Stocks movements | `/api/v1/stock-movements` | GET | - | `productId`, `quantity`, `type`, `source`, `date`, `reason` |

Notes:
- `ProductResponseDTO` does not expose `price`, `quantity`, `consignedQuantity`.
- Mobile computes estimated stock from movement deltas.

## Ventes

| Screen | Endpoint | Method | Request fields | Response fields used |
|---|---|---|---|---|
| Ventes list | `/api/v1/sales` | GET | - | `id`, `clientName`, `products[]`, `montantTotal` |
| Ventes payment status enrich | `/api/v1/invoices` | GET | - | `saleId`, `statut`, `saleDate`, `date`, `lines[]` |
| Nouvelle vente refs | `/api/v1/clients`, `/api/v1/products` | GET | - | ids + names |
| Nouvelle vente create | `/api/v1/sales` | POST | `clientId`, `products[]`, `date`, `invoiceStatus` | `id`, `clientName`, `products[]`, `montantTotal` |

## Parametres

| Screen | Endpoint | Method | Request fields | Response fields used |
|---|---|---|---|---|
| Parametres read | `/api/v1/commerce-settings` | GET | - | `id`, `nom`, `devise` |
| Parametres save | `/api/v1/commerce-settings` | POST | `nom`, `devise`, `facturePDFActive` | `id`, `nom`, `devise` |

Notes:
- No update endpoint currently exposed for settings (POST only in current API).

## Headers and error contract

- Protected calls send:
  - `Authorization: Bearer <accessToken>`
  - `X-Tenant-Id: <tenantId>` (legacy compat + explicit tenant context)
- Standard backend error consumed by mobile:
  - `timestamp`, `status`, `error`, `message`, `path`
