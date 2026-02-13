# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This repository is for building **Glimpse SARA** - a bond trade data visualization and analytics product for fixed-income markets.

**Current State:**
- **Frontend**: Vite + React + TailwindCSS 4 application ([frontend/react-app/](frontend/react-app/)) with client-side routing (react-router-dom v7)
- **Backend**: REST API with OpenAPI specification ([backend/openapi.yaml](backend/openapi.yaml))
- **Backend API Reference**: Detailed API documentation ([backend/api-reference.md](backend/api-reference.md))

**Data Access Pattern:**
The frontend calls the REST API directly via the API layer in `src/api/`. The pre-registered `appId` (`app_bc79932b`) is stored in `src/api/config.json`. All components fetch data through functions in `src/api/records.js` -- never hardcode data.

## Common Commands

### Frontend Development
```bash
# Navigate to frontend
cd frontend/react-app

# Install dependencies
npm install

# Start development server (usually http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint
```

## Architecture & Code Structure

### Frontend Architecture

The Glimpse frontend is a Vite + React application with react-router-dom for client-side routing.

**Tech Stack:**
- React 19.2, Vite 7.2, TailwindCSS 4.1, Recharts 3.7, react-router-dom 7
- Google Material Symbols Outlined (loaded via CDN in index.html)
- Custom dark theme: navy-950/900/850/800 backgrounds, cyan (#00d9b8) accents
- Typography: `font-mono` for data/labels, `font-display` for UI text

**Application Structure:**

- [App.jsx](frontend/react-app/src/App.jsx) - Layout shell (Header, SideNav, main area), all page-level filter state (context, period, months, products, sectors, regions, seniorities), date computation, filter bar UI, StatsBar, and `<Routes>`. Filter state lives here and is passed as props to page components.
- [main.jsx](frontend/react-app/src/main.jsx) - Entry point, wraps App with `<BrowserRouter>`

**Components:**
- [Header.jsx](frontend/react-app/src/components/Header.jsx) - Top navigation header with menu toggle, logo, and action buttons
- [SideNav.jsx](frontend/react-app/src/components/SideNav.jsx) - Side navigation with routing (useLocation/useNavigate), collapses to icon bar (w-64 → w-16), real-time clock, system status
- [StatsBar.jsx](frontend/react-app/src/components/StatsBar.jsx) - Summary statistics bar (sticky below header)
- [DealerVolumeChart.jsx](frontend/react-app/src/components/DealerVolumeChart.jsx) - Horizontal bar chart for dealer volume rankings
- [WeeklyDealerVolumeChart.jsx](frontend/react-app/src/components/WeeklyDealerVolumeChart.jsx) - Weekly dealer volume time series

**Pages (all receive `{ dateFrom, dateTo, context, filters }` props from App.jsx):**
- [DealerRankingsPage.jsx](frontend/react-app/src/pages/DealerRankingsPage.jsx) - Route `/` - Dashboard with dealer volume charts and quick action cards
- [MarketViewPage.jsx](frontend/react-app/src/pages/MarketViewPage.jsx) - Route `/market-view` - Data table with server-side sorting, filtering, pagination, and column visibility toggle
- [PlaceholderPage.jsx](frontend/react-app/src/pages/PlaceholderPage.jsx) - "Coming soon" placeholder for Bond View (`/bond-view`), Analytics (`/analytics`), Reports (`/reports`)

**Routing:**
Routes are defined in App.jsx. The SideNav derives active state from `useLocation().pathname`. All routes share the same layout (Header + SideNav + StatsBar + filter bar).

**Layout:**
The main content area uses explicit width calculation to avoid overflow with the fixed-position sidebar:
- SideNav open: `ml-64 w-[calc(100%-16rem)]`
- SideNav collapsed: `ml-16 w-[calc(100%-4rem)]`

**Date Logic:**
- Market mode: end date is capped at today minus 30 days
- Client mode: uses actual today as end date
- Period presets (30D, 90D, 180D, YTD) OR multi-month selection (mutually exclusive)
- `dateTo` is always exclusive (day after the logical end date) for safe datetime comparison
- When months are selected in market mode, the end date is capped at the market cutoff

**Data Integration Pattern:**

The frontend integrates with the REST API following this pattern:

1. **API Client Setup** (`frontend/react-app/src/api/client.js`):
   - Base API client with methods for GET, POST, PUT, DELETE
   - Handles common headers and error handling
   - Base URL: `http://34.32.211.153:5021/api`

2. **Configuration** (`frontend/react-app/src/api/config.json`):
   - Stores the pre-registered `appId` (must be provided before integration begins)
   - Contains schema information about available tables and columns
   - All API functions import this config to access the `appId`

3. **CRUD Operations** (`frontend/react-app/src/api/records.js`):
   - `listRecords(tableName, params)` - List/filter records with pagination
   - `getRecord(tableName, recordId)` - Get single record
   - `createRecord(tableName, data)` - Create new record
   - `updateRecord(tableName, recordId, data)` - Update record
   - `deleteRecord(tableName, recordId)` - Delete record
   - `aggregateRecords(tableName, params)` - Aggregate data (count, sum, avg, etc.)
   - `executeQuery(params)` - Execute custom SQL queries

4. **Component Integration**:
   - Components import API functions from `./api/records.js`
   - Use React hooks (`useState`, `useEffect`) to manage data loading
   - Display loading states and handle errors gracefully
   - Never hardcode data - always fetch from API

**Dev Server Configuration:**

The Vite config ([vite.config.js](frontend/react-app/vite.config.js)) uses the standard `@vitejs/plugin-react` plugin. The frontend calls the REST API directly (no proxy).

### Backend Architecture

**REST API ([backend/openapi.yaml](backend/openapi.yaml)):**
- Base URL: `http://34.32.211.153:5021/api`
- Implements dynamic database resources with tables, records, and schema management
- Uses pre-registered applications with persistent `appId` values

**Key API Endpoints:**
- `GET /v1/apps/{appId}` - Get app metadata and schema
- `GET /v1/apps/{appId}/tables/{tableName}/records` - List records with filtering, sorting, pagination
- `POST /v1/apps/{appId}/tables/{tableName}/records` - Create record
- `GET /v1/apps/{appId}/tables/{tableName}/records/{recordId}` - Get single record
- `PUT /v1/apps/{appId}/tables/{tableName}/records/{recordId}` - Update record
- `DELETE /v1/apps/{appId}/tables/{tableName}/records/{recordId}` - Delete record
- `GET /v1/apps/{appId}/tables/{tableName}/aggregate` - Aggregate data
- `POST /v1/apps/{appId}/tables/query` - Execute SQL queries

**API Features:**
- Advanced filtering with operators (`eq`, `ne`, `lt`, `gt`, `le`, `ge`, `in`, `like`)
- Nested conditions with `and`/`or` logic
- Sorting (e.g., `"year:desc"`)
- Joins across related tables
- Field selection to limit returned columns
- Pagination with `limit`, `offset`, or `page` parameters

**Data Model:**
The backend uses a dynamic schema system where tables, columns, and relations are defined in the app's schema. The schema is retrieved via `GET /v1/apps/{appId}` and includes:
- Table names and display names
- Column definitions (name, type, displayName)
- Relations between tables (one-to-one, one-to-many, many-to-one, many-to-many)

### Data Model

The app uses a single table `trade_records` containing bond trade data. See `src/api/config.json` for the full schema.

**Key fields:**
- `counter_party` - dealer name
- `glimpse_buy_side` - client name
- `side` - Buy/Sell
- `size_in_eur` - trade volume in EUR millions
- `size_in_MM` - capped display size (text, e.g. "5+")
- `size_in_MM_capped_num` - numeric version of capped size **in local currency**. For capped volume in EUR, always convert: `size_in_MM_capped_num * currency_to_usd_conversion_rate * usd_to_eur_conversion_rate`. Use the raw field only for sorting size in tables.
- `trade_date` - date as datetime, but time is ALWAYS `00:00:00` (e.g. `"2025-08-11T00:00:00"`)
- `trade_time` - time-only string, NOT a datetime (e.g. `"20:01:20"`)
- `isin`, `ticker`, `venue`, `currency`, `price`, `coupon_perc`, `maturity`
- `secmst_entity_name` - bond issuer name
- `secmst_glimpse_sector`, `secmst_region`, `secmst_seniority` - classification fields
- `secmst_bond_category` - product type (used for "Products" filter)

**Important data caveats:**
- `trade_date` and `trade_time` are separate fields. There is no combined datetime field.
- The API only supports single-field sorting (`"field:asc"`), NOT multi-field sort. You cannot do `"trade_date:desc,trade_time:desc"`.
- `executeQuery` returns `{ data, executionTime }` with NO pagination metadata (no total count, no totalPages). If you need paginated results with counts, use `listRecords` instead.
- When sorting the MarketView table by Size, use `size_in_MM_capped_num` (the numeric field) as the sort key, while displaying the text `size_in_MM` field.

## Key Files Reference

**Integration Documentation:**
- [app_integration_appID_preregistered.md](app_integration_appID_preregistered.md) - Step-by-step integration instructions
- [backend/api-reference.md](backend/api-reference.md) - Complete API reference
- [backend/openapi.yaml](backend/openapi.yaml) - OpenAPI specification

**Frontend - Layout & Routing:**
- [frontend/react-app/src/main.jsx](frontend/react-app/src/main.jsx) - Entry point with BrowserRouter
- [frontend/react-app/src/App.jsx](frontend/react-app/src/App.jsx) - Layout shell, filter state, routes
- [frontend/react-app/src/components/Header.jsx](frontend/react-app/src/components/Header.jsx) - Header navigation
- [frontend/react-app/src/components/SideNav.jsx](frontend/react-app/src/components/SideNav.jsx) - Side navigation with routing
- [frontend/react-app/src/components/StatsBar.jsx](frontend/react-app/src/components/StatsBar.jsx) - Summary statistics

**Frontend - Pages:**
- [frontend/react-app/src/pages/DealerRankingsPage.jsx](frontend/react-app/src/pages/DealerRankingsPage.jsx) - Dashboard (route `/`)
- [frontend/react-app/src/pages/MarketViewPage.jsx](frontend/react-app/src/pages/MarketViewPage.jsx) - Data table (route `/market-view`)
- [frontend/react-app/src/pages/PlaceholderPage.jsx](frontend/react-app/src/pages/PlaceholderPage.jsx) - Coming soon placeholder

**Frontend - Charts:**
- [frontend/react-app/src/components/DealerVolumeChart.jsx](frontend/react-app/src/components/DealerVolumeChart.jsx) - Dealer volume bar chart
- [frontend/react-app/src/components/WeeklyDealerVolumeChart.jsx](frontend/react-app/src/components/WeeklyDealerVolumeChart.jsx) - Weekly volume chart

**Frontend - Config:**
- [frontend/react-app/index.html](frontend/react-app/index.html) - HTML entry (includes Material Symbols font)
- [frontend/react-app/vite.config.js](frontend/react-app/vite.config.js) - Vite build configuration
- [frontend/react-app/package.json](frontend/react-app/package.json) - Dependencies and scripts
- [frontend/react-app/src/index.css](frontend/react-app/src/index.css) - Global styles and TailwindCSS theme
- [frontend/react-app/src/theme.css](frontend/react-app/src/theme.css) - Additional theme definitions

**API Layer:**
- [frontend/react-app/src/api/client.js](frontend/react-app/src/api/client.js) - Base API client (GET, POST, PUT, DELETE)
- [frontend/react-app/src/api/config.json](frontend/react-app/src/api/config.json) - App configuration with appId and full schema
- [frontend/react-app/src/api/records.js](frontend/react-app/src/api/records.js) - CRUD operations, aggregation, SQL queries

## Important Patterns

**API Request Headers:**
- Always include `Content-Type: application/json`
- Request/response bodies use JSON format

**Filter Operators:**
- `eq` - equals
- `ne` - not equals
- `lt` - less than
- `gt` - greater than
- `le` - less than or equal
- `ge` - greater than or equal
- `in` - value in array
- `like` - SQL LIKE pattern

**Advanced Filtering:**
```javascript
// Simple filter
filter: { field: 'year', op: 'gt', value: '2020' }

// AND conditions
filter: { and: [
  { field: 'year', op: 'ge', value: '2020' },
  { field: 'category', op: 'eq', value: 'landscapes' }
]}

// OR conditions
filter: { or: [
  { field: 'category', op: 'eq', value: 'landscapes' },
  { field: 'category', op: 'eq', value: 'urban' }
]}

// Nested conditions
filter: { and: [
  { or: [
    { field: 'category', op: 'eq', value: 'landscapes' },
    { field: 'category', op: 'eq', value: 'urban' }
  ]},
  { field: 'year', op: 'ge', value: '2020' }
]}
```

**Pagination:**
```javascript
// Using limit and offset
{ limit: 50, offset: 100 }

// Using page (starts at 1)
{ limit: 50, page: 3 }
```

**Sorting:**
```javascript
// Single field ONLY — the API does NOT support multi-field sort
sort: 'year:desc'
sort: 'title:asc'
// ❌ sort: 'trade_date:desc,trade_time:desc' — NOT SUPPORTED
```

**Common Mistakes to Avoid:**
- ❌ Hardcoding `appId` in API calls → ✅ Load from `config.json`
- ❌ Missing `Content-Type` header → ✅ Set in API client
- ❌ Not handling errors → ✅ Use try-catch blocks
- ❌ Hardcoding data in components → ✅ Always fetch from API
- ❌ Forgetting to URL-encode params → ✅ Use `URLSearchParams`
- ❌ Not checking response status → ✅ Check `response.ok` before parsing
- ❌ Assuming `trade_time` is a datetime → ✅ It's a time-only string ("20:01:20"), NOT a full datetime
- ❌ Assuming `trade_date` contains time info → ✅ Time portion is always 00:00:00
- ❌ Using `executeQuery` for paginated tables → ✅ Use `listRecords` which returns pagination metadata
- ❌ Attempting multi-field sort with the API → ✅ API only supports single-field sort
- ❌ Using `new Date(val)` on time-only strings → ✅ Detect time format with regex first
- ❌ Using `flex-1` with fixed-position sidebars → ✅ Use explicit `w-[calc()]` for correct width constraints

## Development Workflow

1. All data access goes through `src/api/records.js` -- import and use the functions there
2. The `appId` is stored in `src/api/config.json` -- never hardcode it
3. Components use `useState`/`useEffect` to load data, with loading and error states
4. For complex queries (joins, grouping, aggregation), use `executeQuery()` with parameterized SQL
5. For simple CRUD, use `listRecords`, `getRecord`, `createRecord`, `updateRecord`, `deleteRecord`
6. For aggregations (count, sum, avg, min, max with optional groupBy), use `aggregateRecords()`
7. New pages go in `src/pages/`, receive `{ dateFrom, dateTo, context, filters }` props from App.jsx
8. Add new routes to the `<Routes>` block in App.jsx and add navigation entries to SideNav.jsx
9. Use Google Material Symbols Outlined for icons (`<span className="material-symbols-outlined">icon_name</span>`)
10. Follow the existing theme: navy backgrounds, cyan accents, font-mono for data, compact table rows

## Design System Notes

**Color Palette (TailwindCSS 4 custom theme):**
- Backgrounds: `bg-navy-950` (darkest), `bg-navy-900`, `bg-navy-850`, `bg-navy-800`
- Text: `text-primary` (white), `text-secondary` (light gray), `text-muted` (dim gray)
- Accent: `text-cyan` / `bg-cyan-500` (#00d9b8)
- Borders: `border-default` (standard), `border-subtle` (lighter)
- Buy/Sell: `text-cyan` for Buy, `text-red-400` for Sell

**UI Patterns:**
- Filter buttons: `bg-cyan-500 text-navy-950 font-semibold` when active, `text-muted hover:text-secondary` when inactive
- Dropdowns: `bg-navy-850 border border-subtle rounded-lg shadow-xl` with checkbox-style items
- Tables: `text-xs font-mono`, compact rows (`py-1.5`), `hover:bg-navy-850/50`, column headers uppercase
- Animations: `opacity-0 animate-fade-in-up` for entrance, `animate-glow-pulse` for status indicators
- SideNav: Active item has `border-cyan bg-navy-850 text-primary glow-cyan` left border accent
