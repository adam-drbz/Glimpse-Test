# Frontend-Backend API Integration Instructions

## Overview

Integrate a Vite-React frontend with the backend REST API. The backend provides a complete REST API for managing applications, tables, and records as defined in `backend/openapi.yaml`.

The user MUST provide you with an appID before you begin.  If it is not provided, STOP and ASK for it.

**Directory Structure:**
```
/root-dir
├── backend/
│   └── openapi.yaml              # API specification
└── glp/
        └── src/
            └── api/
                ├── client.ts/js      # Base API client configuration
                ├── config.json       # App configuration (appId, schema)
                └── *.ts or *.js      # API functions
```

## Prerequisites

**Review API Documentation:**

- Check `backend/openapi.yaml` for complete API endpoints and schemas
- Base URL: `http://34.32.211.153:5021/api` (development server)
- All endpoints use JSON request/response format
- Always include `Content-Type: application/json` header

## Implementation Steps

 Step 1: Refactor Data Access Layer
 Step 2: Create Base API Client
 Step 3: Retrieve App Metadata and Explore tables
 Step 4: Implement CRUD Operations
 Step 5: Advanced Features
 Step 6: Component Integration and Check for existing records via API
 Step 7: Install dependencies in frontend/react-app
 Step 8: Start the dev server from frontend/react-app

## Common Mistakes to Avoid

| ❌ Wrong | ✅ Correct |
|---------|----------|
| Hardcoding `appId` in API calls | Load `appId` from `config.json` |
| Missing `Content-Type` header | Always set `Content-Type: application/json` |
| Not handling errors | Use try-catch blocks and display user-friendly errors |
| Mutating data directly in components | Always use API functions |
| Forgetting to URL-encode query params | Use `URLSearchParams` for building query strings |
| Not validating response status | Check `response.ok` before parsing JSON |

## Success Criteria

✓ Base API client created with proper error handling
✓ All CRUD operations implemented using REST endpoints
✓ Components use API functions instead of direct data access
✓ Advanced features (filtering, sorting, aggregation) working
✓ Error handling in place for all API calls
✓ Type safety (if using TypeScript)

## Quick Reference

**Key API Endpoints:**

- `GET /v1/apps/{appId}` - Get app details
- `GET /v1/apps/{appId}/tables/{tableName}/records` - List records
- `POST /v1/apps/{appId}/tables/{tableName}/records` - Create record
- `GET /v1/apps/{appId}/tables/{tableName}/records/{recordId}` - Get record
- `PUT /v1/apps/{appId}/tables/{tableName}/records/{recordId}` - Update record
- `DELETE /v1/apps/{appId}/tables/{tableName}/records/{recordId}` - Delete record
- `GET /v1/apps/{appId}/tables/{tableName}/aggregate` - Aggregate data
- `POST /v1/apps/{appId}/tables/query` - Execute SQL query

**Filter Operators:**
- `eq` - equals
- `ne` - not equals
- `lt` - less than
- `gt` - greater than
- `le` - less than or equal
- `ge` - greater than or equal
- `in` - value in array
- `like` - SQL LIKE pattern

**Key Resources:**
- Config file: `./frontend/react-app/src/api/config.json`
- API spec: `./backend/openapi.yaml`
- Base URL: `http://34.32.211.153:5021/api`



## Implementation Steps Detail

### Step 1 Detail: Refactor Data Access Layer
- Move all data operations from components to `./frontend/react-app/src/api/`:
- Move hardcoded data and direct manipulation from components into a temporary file
- Create clean API function interfaces
- Components only call API functions, never access data directly
- All API functions use the REST API endpoints from `openapi.yaml`

### Step 2 Detail: Create Base API Client

Create `./frontend/react-app/src/api/client.ts` (or `.js`) to handle common API functionality:

```typescript
// TypeScript version
const API_BASE_URL = 'http://34.32.211.153:5021/api';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  success?: boolean;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const defaultHeaders = {
      'Content-Type': 'application/json',
    };

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
```

```javascript
// JavaScript version
const API_BASE_URL = 'http://34.32.211.153:5021/api';

export class ApiClient {
  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    const defaultHeaders = {
      'Content-Type': 'application/json',
    };

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
```

### Step 3 Detail: Retrieve App Metadata and Explore tables

Since the backend is already initialized with a pre-registered appId, you need to:

1. **Retrieve the app metadata** from the backend using `GET /v1/apps/{appId}`
2. **Extract the table structure** to understand what tables and columns exist
3. **Save the configuration** to `config.json` for use by other API functions

**API Endpoint:** `GET /v1/apps/{appId}`

```typescript
// TypeScript version
import { apiClient } from './client';

export interface TableColumn {
  name: string;
  displayName?: string;
  type: 'text' | 'float' | 'integer' | 'boolean' | 'date' | 'datetime' | 'json' | 'blob';
}

export interface TableRelation {
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  targetTable: string;
  sourceColumn: string;
  targetColumn: string;
}

export interface Table {
  name: string;
  displayName?: string;
  columns: TableColumn[];
  relations?: TableRelation[];
}

export interface ResourceSchema {
  tables: Table[];
  workflows?: any[];
}

export interface AppMetadata {
  appId: string;
  schema: ResourceSchema;
  createdAt?: string;
  updatedAt?: string;
}

export async function getAppMetadata(appId: string): Promise<AppMetadata> {
  const response = await apiClient.get<AppMetadata>(`/v1/apps/${appId}`);
  return response;
}

// Example usage: Retrieve and save app metadata
export async function retrieveAndSaveAppMetadata(appId: string) {
  try {
    const appMetadata = await getAppMetadata(appId);
    console.log('App metadata retrieved:', appMetadata);

    // Create config object for frontend use
    const config = {
      appId: appMetadata.appId,
      schema: appMetadata.schema
    };

    // Save to config.json file (you'll need to manually create this file)
    console.log('Save this configuration to ./frontend/react-app/src/api/config.json:');
    console.log(JSON.stringify(config, null, 2));

    // Log table structure for reference
    console.log('\nAvailable tables:');
    appMetadata.schema.tables.forEach(table => {
      console.log(`- ${table.name} (${table.displayName || 'no display name'})`);
      console.log('  Columns:', table.columns.map(c => c.name).join(', '));
    });

    return appMetadata;
  } catch (error) {
    console.error('Failed to retrieve app metadata:', error);
    throw error;
  }
}
```

```javascript
// JavaScript version
import { apiClient } from './client';

export async function getAppMetadata(appId) {
  const response = await apiClient.get(`/v1/apps/${appId}`);
  return response;
}

export async function retrieveAndSaveAppMetadata(appId) {
  try {
    const appMetadata = await getAppMetadata(appId);
    console.log('App metadata retrieved:', appMetadata);

    // Create config object for frontend use
    const config = {
      appId: appMetadata.appId,
      schema: appMetadata.schema
    };

    // Save to config.json file (you'll need to manually create this file)
    console.log('Save this configuration to ./frontend/react-app/src/api/config.json:');
    console.log(JSON.stringify(config, null, 2));

    // Log table structure for reference
    console.log('\nAvailable tables:');
    appMetadata.schema.tables.forEach(table => {
      console.log(`- ${table.name} (${table.displayName || 'no display name'})`);
      console.log('  Columns:', table.columns.map(c => c.name).join(', '));
    });

    return appMetadata;
  } catch (error) {
    console.error('Failed to retrieve app metadata:', error);
    throw error;
  }
}
```

**After retrieving the metadata**, create `./frontend/react-app/src/api/config.json` with the following structure:

```json
{
  "appId": "your-app-id-here",
  "schema": {
    "tables": [
      {
        "name": "gallery_items",
        "displayName": "Gallery Items",
        "columns": [
          { "name": "id", "type": "integer" },
          { "name": "category", "type": "text" },
          { "name": "image_url", "type": "text" },
          { "name": "title", "type": "text" },
          { "name": "year", "type": "text" }
        ]
      }
    ]
  }
}
```

This config file will be imported by all other API functions to get the `appId` for making requests.


### Step 4 Detail: Implement CRUD Operations

Create API functions for each resource operation using the REST endpoints.

#### **Records API - List Records**

**Endpoint:** `GET /v1/apps/{appId}/tables/{tableName}/records`

**Create `./frontend/react-app/src/api/records.ts` (or `.js`):**

```typescript
// TypeScript version
import { apiClient } from './client';
import config from './config.json';

export interface ListRecordsParams {
  filter?: Record<string, any>;
  sort?: string;
  join?: string;
  fields?: string;
  limit?: number;
  offset?: number;
  page?: number;
}

export interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  page: number;
  totalPages: number;
}

export interface ListRecordsResponse {
  data: any[];
  pagination: PaginationInfo;
}

export async function listRecords(
  tableName: string,
  params: ListRecordsParams = {}
): Promise<ListRecordsResponse> {
  const { appId } = config;

  const queryParams = new URLSearchParams();

  if (params.filter) {
    queryParams.append('filter', JSON.stringify(params.filter));
  }
  if (params.sort) {
    queryParams.append('sort', params.sort);
  }
  if (params.join) {
    queryParams.append('join', params.join);
  }
  if (params.fields) {
    queryParams.append('fields', params.fields);
  }
  if (params.limit) {
    queryParams.append('limit', params.limit.toString());
  }
  if (params.offset !== undefined) {
    queryParams.append('offset', params.offset.toString());
  }
  if (params.page) {
    queryParams.append('page', params.page.toString());
  }

  const queryString = queryParams.toString();
  const endpoint = `/v1/apps/${appId}/tables/${tableName}/records${queryString ? `?${queryString}` : ''}`;

  return apiClient.get<ListRecordsResponse>(endpoint);
}

// Example: List gallery items with filtering
export async function listGalleryItems(category?: string, limit: number = 100) {
  const params: ListRecordsParams = {
    limit,
    sort: 'year:desc'
  };

  if (category) {
    params.filter = { category };
  }

  return listRecords('gallery_items', params);
}
```

```javascript
// JavaScript version
import { apiClient } from './client';
import config from './config.json';

export async function listRecords(tableName, params = {}) {
  const { appId } = config;

  const queryParams = new URLSearchParams();

  if (params.filter) {
    queryParams.append('filter', JSON.stringify(params.filter));
  }
  if (params.sort) {
    queryParams.append('sort', params.sort);
  }
  if (params.join) {
    queryParams.append('join', params.join);
  }
  if (params.fields) {
    queryParams.append('fields', params.fields);
  }
  if (params.limit) {
    queryParams.append('limit', params.limit.toString());
  }
  if (params.offset !== undefined) {
    queryParams.append('offset', params.offset.toString());
  }
  if (params.page) {
    queryParams.append('page', params.page.toString());
  }

  const queryString = queryParams.toString();
  const endpoint = `/v1/apps/${appId}/tables/${tableName}/records${queryString ? `?${queryString}` : ''}`;

  return apiClient.get(endpoint);
}

export async function listGalleryItems(category, limit = 100) {
  const params = {
    limit,
    sort: 'year:desc'
  };

  if (category) {
    params.filter = { category };
  }

  return listRecords('gallery_items', params);
}
```

#### **Records API - Get Single Record**

**Endpoint:** `GET /v1/apps/{appId}/tables/{tableName}/records/{recordId}`

```typescript
// TypeScript version
export async function getRecord(
  tableName: string,
  recordId: number,
  join?: string
): Promise<any> {
  const { appId } = config;
  const queryString = join ? `?join=${join}` : '';
  const endpoint = `/v1/apps/${appId}/tables/${tableName}/records/${recordId}${queryString}`;

  return apiClient.get(endpoint);
}
```

```javascript
// JavaScript version
export async function getRecord(tableName, recordId, join) {
  const { appId } = config;
  const queryString = join ? `?join=${join}` : '';
  const endpoint = `/v1/apps/${appId}/tables/${tableName}/records/${recordId}${queryString}`;

  return apiClient.get(endpoint);
}
```

#### **Records API - Create Record**

**Endpoint:** `POST /v1/apps/{appId}/tables/{tableName}/records`

```typescript
// TypeScript version
export interface CreateRecordResponse {
  success: boolean;
  message: string;
  id: number;
  data: any;
}

export async function createRecord(
  tableName: string,
  data: Record<string, any>
): Promise<CreateRecordResponse> {
  const { appId } = config;
  const endpoint = `/v1/apps/${appId}/tables/${tableName}/records`;

  return apiClient.post<CreateRecordResponse>(endpoint, data);
}

// Example: Create a gallery item
export async function createGalleryItem(item: {
  category: string;
  image_url: string;
  title: string;
  year: string;
}) {
  return createRecord('gallery_items', item);
}
```

```javascript
// JavaScript version
export async function createRecord(tableName, data) {
  const { appId } = config;
  const endpoint = `/v1/apps/${appId}/tables/${tableName}/records`;

  return apiClient.post(endpoint, data);
}

export async function createGalleryItem(item) {
  return createRecord('gallery_items', item);
}
```

#### **Records API - Update Record**

**Endpoint:** `PUT /v1/apps/{appId}/tables/{tableName}/records/{recordId}`

```typescript
// TypeScript version
export interface UpdateRecordResponse {
  success: boolean;
  message: string;
  data: any;
}

export async function updateRecord(
  tableName: string,
  recordId: number,
  data: Record<string, any>
): Promise<UpdateRecordResponse> {
  const { appId } = config;
  const endpoint = `/v1/apps/${appId}/tables/${tableName}/records/${recordId}`;

  return apiClient.put<UpdateRecordResponse>(endpoint, data);
}
```

```javascript
// JavaScript version
export async function updateRecord(tableName, recordId, data) {
  const { appId } = config;
  const endpoint = `/v1/apps/${appId}/tables/${tableName}/records/${recordId}`;

  return apiClient.put(endpoint, data);
}
```

#### **Records API - Delete Record**

**Endpoint:** `DELETE /v1/apps/{appId}/tables/{tableName}/records/{recordId}`

```typescript
// TypeScript version
export interface DeleteRecordResponse {
  success: boolean;
  message: string;
}

export async function deleteRecord(
  tableName: string,
  recordId: number
): Promise<DeleteRecordResponse> {
  const { appId } = config;
  const endpoint = `/v1/apps/${appId}/tables/${tableName}/records/${recordId}`;

  return apiClient.delete<DeleteRecordResponse>(endpoint);
}
```

```javascript
// JavaScript version
export async function deleteRecord(tableName, recordId) {
  const { appId } = config;
  const endpoint = `/v1/apps/${appId}/tables/${tableName}/records/${recordId}`;

  return apiClient.delete(endpoint);
}
```

### Step 5 Detail: Advanced Features

#### **Aggregation**

**Endpoint:** `GET /v1/apps/{appId}/tables/{tableName}/aggregate`

```typescript
// TypeScript version
export interface AggregateParams {
  function: 'count' | 'sum' | 'avg' | 'min' | 'max';
  field?: string;
  groupBy?: string;
  filter?: Record<string, any>;
}

export interface AggregateResponse {
  result: number | any[];
  aggregation: {
    function: string;
    field?: string;
    groupBy?: string[];
  };
}

export async function aggregateRecords(
  tableName: string,
  params: AggregateParams
): Promise<AggregateResponse> {
  const { appId } = config;

  const queryParams = new URLSearchParams();
  queryParams.append('function', params.function);

  if (params.field) {
    queryParams.append('field', params.field);
  }
  if (params.groupBy) {
    queryParams.append('groupBy', params.groupBy);
  }
  if (params.filter) {
    queryParams.append('filter', JSON.stringify(params.filter));
  }

  const endpoint = `/v1/apps/${appId}/tables/${tableName}/aggregate?${queryParams.toString()}`;

  return apiClient.get<AggregateResponse>(endpoint);
}

// Example: Count items by category
export async function countItemsByCategory() {
  return aggregateRecords('gallery_items', {
    function: 'count',
    groupBy: 'category'
  });
}
```

#### **SQL Query**

**Endpoint:** `POST /v1/apps/{appId}/tables/query`

```typescript
// TypeScript version
export interface QueryParams {
  query: string;
  params?: any[];
  readonly?: boolean;
}

export interface QueryResponse {
  success: boolean;
  data?: any[];
  rowsAffected?: number;
  lastInsertId?: number;
  executionTime: number;
}

export async function executeQuery(params: QueryParams): Promise<QueryResponse> {
  const { appId } = config;
  const endpoint = `/v1/apps/${appId}/tables/query`;

  return apiClient.post<QueryResponse>(endpoint, params);
}

// Example: Complex query with JOIN
export async function getItemsWithCategoryLabels(year: string) {
  return executeQuery({
    query: `
      SELECT g.*, c.label as category_label
      FROM gallery_items g
      JOIN categories c ON g.category_id = c.id
      WHERE g.year = ?
    `,
    params: [year],
    readonly: true
  });
}
```

### Step 6 Detail: Component Integration and Check for existing records via API

Check whether any existing records exist using the List Records function you created earlier. If records exist, there is NO NEED TO SEED DATA FROM THE APP.

Update your React components to use the API functions:

```typescript
// TypeScript example
import React, { useEffect, useState } from 'react';
import { listGalleryItems, createGalleryItem, deleteRecord } from './api/records';

export function GalleryComponent() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    try {
      setLoading(true);
      const response = await listGalleryItems();
      setItems(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(item) {
    try {
      await createGalleryItem(item);
      await loadItems(); // Refresh the list
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteRecord('gallery_items', id);
      await loadItems(); // Refresh the list
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {items.map(item => (
        <div key={item.id}>
          <h3>{item.title}</h3>
          <button onClick={() => handleDelete(item.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}
```

## Advanced Filtering Examples

The API supports advanced filtering with operators and logical combinations:

```typescript
// Filter with operators
await listRecords('gallery_items', {
  filter: {
    field: 'year',
    op: 'gt',
    value: '2020'
  }
});

// Multiple AND conditions
await listRecords('gallery_items', {
  filter: {
    and: [
      { field: 'year', op: 'ge', value: '2020' },
      { field: 'category', op: 'eq', value: 'landscapes' }
    ]
  }
});

// Multiple OR conditions
await listRecords('gallery_items', {
  filter: {
    or: [
      { field: 'category', op: 'eq', value: 'landscapes' },
      { field: 'category', op: 'eq', value: 'urban' }
    ]
  }
});

// IN operator
await listRecords('gallery_items', {
  filter: {
    field: 'category',
    op: 'in',
    value: ['landscapes', 'urban', 'portraits']
  }
});

// LIKE operator with wildcards
await listRecords('gallery_items', {
  filter: {
    field: 'title',
    op: 'like',
    value: '%mountain%'
  }
});

// Nested conditions
await listRecords('gallery_items', {
  filter: {
    and: [
      {
        or: [
          { field: 'category', op: 'eq', value: 'landscapes' },
          { field: 'category', op: 'eq', value: 'urban' }
        ]
      },
      { field: 'year', op: 'ge', value: '2020' }
    ]
  }
});
```


