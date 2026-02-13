# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This repository is for building **Glimpse** - a data visualization and analytics product.

**Current State:**
- **Frontend**: Vite + React application ([frontend/react-app/](frontend/react-app/)) - Fully integrated with REST API
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

The Glimpse frontend is a Vite + React application that integrates with the backend REST API.

**Current Components:**
- [App.jsx](frontend/react-app/src/App.jsx) - Main application with dashboard, stats, and navigation
- [Header.jsx](frontend/react-app/src/components/Header.jsx) - Top navigation header with menu, logo, and action buttons
- [SideNav.jsx](frontend/react-app/src/components/SideNav.jsx) - Side navigation panel
- [DealerVolumeChart.jsx](frontend/react-app/src/components/DealerVolumeChart.jsx) - Chart component for dealer volume visualization

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

The app uses a single table `trade_records` containing bond trade data with fields including `counter_party` (dealer name), `glimpse_buy_side` (client name), `side` (Buy/Sell), `size_in_eur` (trade volume in EUR millions), `trade_date`, `isin`, `ticker`, `venue`, and many more. See `src/api/config.json` for the full schema.

## Key Files Reference

**Integration Documentation:**
- [app_integration_appID_preregistered.md](app_integration_appID_preregistered.md) - Step-by-step integration instructions
- [backend/api-reference.md](backend/api-reference.md) - Complete API reference
- [backend/openapi.yaml](backend/openapi.yaml) - OpenAPI specification

**Frontend:**
- [frontend/react-app/src/App.jsx](frontend/react-app/src/App.jsx) - Main application component
- [frontend/react-app/src/components/Header.jsx](frontend/react-app/src/components/Header.jsx) - Header navigation
- [frontend/react-app/src/components/SideNav.jsx](frontend/react-app/src/components/SideNav.jsx) - Side navigation
- [frontend/react-app/src/components/DealerVolumeChart.jsx](frontend/react-app/src/components/DealerVolumeChart.jsx) - Volume chart
- [frontend/react-app/vite.config.js](frontend/react-app/vite.config.js) - Vite build configuration
- [frontend/react-app/package.json](frontend/react-app/package.json) - Frontend dependencies and scripts

**API Layer:**
- [frontend/react-app/src/api/client.js](frontend/react-app/src/api/client.js) - Base API client (GET, POST, PUT, DELETE)
- [frontend/react-app/src/api/config.json](frontend/react-app/src/api/config.json) - App configuration with appId and schema
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
// Single field
sort: 'year:desc'
sort: 'title:asc'
```

**Common Mistakes to Avoid:**
- ❌ Hardcoding `appId` in API calls → ✅ Load from `config.json`
- ❌ Missing `Content-Type` header → ✅ Set in API client
- ❌ Not handling errors → ✅ Use try-catch blocks
- ❌ Hardcoding data in components → ✅ Always fetch from API
- ❌ Forgetting to URL-encode params → ✅ Use `URLSearchParams`
- ❌ Not checking response status → ✅ Check `response.ok` before parsing

## Development Workflow

1. All data access goes through `src/api/records.js` -- import and use the functions there
2. The `appId` is stored in `src/api/config.json` -- never hardcode it
3. Components use `useState`/`useEffect` to load data, with loading and error states
4. For complex queries (joins, grouping, aggregation), use `executeQuery()` with parameterized SQL
5. For simple CRUD, use `listRecords`, `getRecord`, `createRecord`, `updateRecord`, `deleteRecord`
6. For aggregations (count, sum, avg, min, max with optional groupBy), use `aggregateRecords()`
