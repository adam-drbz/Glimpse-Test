# Boltzbit Dynamic DB API Reference

Base URL: `/api/v1`

All endpoints are scoped to an application via `{appId}`.

---

## Table of Contents

1. [Application Management](#1-application-management)
2. [Table Management](#2-table-management)
3. [Records CRUD](#3-records-crud)
4. [Aggregation](#4-aggregation)
5. [Raw SQL Query](#5-raw-sql-query)
6. [Workflows](#6-workflows)
7. [Filter Syntax Reference](#7-filter-syntax-reference)
8. [Column Type Reference](#8-column-type-reference)
9. [Relation Reference](#9-relation-reference)

---

## 1. Application Management

### POST /v1/apps
Create a new application with tables, relations, and optional workflows.

Request body — `ResourceSchema`:
```json
{
  "tables": [ Table, ... ],
  "workflows": [ Workflow, ... ]   // optional
}
```

Response `201`:
```json
{
  "success": true,
  "message": "Application resources created successfully",
  "appId": "app_123abc",
  "tablesCreated": ["gallery_items", "categories"],
  "workflowsCreated": ["content_approval"]
}
```

### GET /v1/apps
List all applications.

### GET /v1/apps/{appId}
Get application schema and metadata.

### PUT /v1/apps/{appId}
Update application schema (recreates tables). Same request body as POST.

### DELETE /v1/apps/{appId}
Delete application and all associated tables.

---

## 2. Table Management

### GET /v1/apps/{appId}/tables
List all tables in an application.

### POST /v1/apps/{appId}/tables
Add a new table. Request body is a single `Table` object.

### GET /v1/apps/{appId}/tables/{tableName}
Get a table's schema and metadata.

### PUT /v1/apps/{appId}/tables/{tableName}
Update a table's schema (recreates table with new schema).

### DELETE /v1/apps/{appId}/tables/{tableName}
Delete a table.

---

## 3. Records CRUD

### GET /v1/apps/{appId}/tables/{tableName}/records

List records with filtering, sorting, joins, field selection, and pagination.

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `filter` | JSON string | Filter criteria (see Filter Syntax Reference below) |
| `sort` | string | Sort order, e.g. `"year:desc"` or `"title:asc"` |
| `join` | string | Comma-separated related table names to join, e.g. `"categories,authors"` |
| `fields` | string | Comma-separated field names to return, e.g. `"id,title,year"` |
| `limit` | integer | Max records to return (1-1000, default 100) |
| `offset` | integer | Records to skip (default 0) |
| `page` | integer | Page number (alternative to offset, starts at 1) |

**Response:**
```json
{
  "data": [ { record }, ... ],
  "pagination": {
    "total": 100,
    "limit": 50,
    "offset": 0,
    "page": 1,
    "totalPages": 2
  }
}
```

**Key behavior:**
- The `join` parameter resolves defined relations and includes related table columns in results
- Filters can reference joined table columns with dot notation: `{"field": "categories.label", "op": "eq", "value": "Landscapes"}`
- When using `join`, filter on base table with: `{"field": "gallery_items.year", "op": "ge", "value": "2020"}`

### POST /v1/apps/{appId}/tables/{tableName}/records
Create a record. Body is a flat JSON object of column name → value pairs.

Response `201`: `{ success, message, id, data }`

### GET /v1/apps/{appId}/tables/{tableName}/records/{recordId}
Get single record by ID. Supports `join` query parameter.

### PUT /v1/apps/{appId}/tables/{tableName}/records/{recordId}
Update a record. Body is a partial JSON object — only fields to update.

### DELETE /v1/apps/{appId}/tables/{tableName}/records/{recordId}
Delete a record.

---

## 4. Aggregation

### GET /v1/apps/{appId}/tables/{tableName}/aggregate

**Query parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `function` | string | yes | `count`, `sum`, `avg`, `min`, `max` |
| `field` | string | no* | Column to aggregate on (*not needed for `count`) |
| `groupBy` | string | no | Comma-separated columns to group by |
| `filter` | JSON string | no | Same filter syntax as Records endpoint |

**Response (ungrouped):**
```json
{
  "result": 100,
  "aggregation": { "function": "count" }
}
```

**Response (grouped):**
```json
{
  "result": [
    { "category": "landscapes", "count": 40 },
    { "category": "portraits", "count": 30 }
  ],
  "aggregation": { "function": "count", "groupBy": ["category"] }
}
```

**Common patterns:**
- Total record count: `?function=count`
- Count by status: `?function=count&groupBy=status`
- Average price: `?function=avg&field=price`
- Sum by category: `?function=sum&field=amount&groupBy=category`
- Max value with filter: `?function=max&field=price&filter={"field":"status","op":"eq","value":"active"}`

---

## 5. Raw SQL Query

### POST /v1/apps/{appId}/tables/query

For queries that the structured endpoints cannot express.

**Request body:**
```json
{
  "query": "SELECT g.*, c.label as category_label FROM gallery_items g JOIN categories c ON g.category_id = c.id WHERE g.year = ?",
  "params": ["2024"],
  "readonly": true
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `query` | string | yes | SQL query with `?` parameter placeholders |
| `params` | array | no | Values for parameterized query (prevents SQL injection) |
| `readonly` | boolean | no | If `true`, only SELECT queries allowed (default `false`) |

**Response (SELECT):**
```json
{
  "success": true,
  "data": [ { row }, ... ],
  "executionTime": 8.2
}
```

**Response (INSERT/UPDATE/DELETE):**
```json
{
  "success": true,
  "rowsAffected": 1,
  "lastInsertId": 456,
  "executionTime": 5.1
}
```

**When to use this endpoint:**
- Multi-table JOINs with GROUP BY and computed columns
- Window functions (ROW_NUMBER, RANK, running totals)
- CASE expressions for conditional aggregation
- Subqueries and CTEs
- INSERT/UPDATE with complex WHERE conditions
- Any query the Records + Aggregate endpoints can't express

**Always use parameterized queries** — `?` placeholders with `params` array.

---

## 6. Workflows

Workflows are defined in the `ResourceSchema` alongside tables:

```json
{
  "tables": [ ... ],
  "workflows": [
    {
      "name": "content_approval",
      "description": "Workflow for approving gallery content",
      "meta": {},
      "steps": [
        {
          "id": "submit",
          "nodeType": "start",
          "config": {},
          "categories": "submission",
          "dependsOn": []
        },
        {
          "id": "review",
          "nodeType": "approval",
          "config": { "approvers": ["editor", "admin"] },
          "categories": "review",
          "dependsOn": ["submit"]
        },
        {
          "id": "publish",
          "nodeType": "action",
          "config": {},
          "categories": "publishing",
          "dependsOn": ["review"]
        }
      ]
    }
  ]
}
```

**WorkflowStep fields:**
- `id` (required) — Unique step identifier
- `nodeType` (required) — Type of step (e.g. `start`, `approval`, `action`, `condition`, `end`)
- `config` — Step-specific configuration
- `categories` — Classification for the step
- `dependsOn` — Array of step IDs this step depends on (defines execution order)

---

## 7. Filter Syntax Reference

The `filter` parameter (used by both Records and Aggregate endpoints) supports:

### Simple equality (backward compatible)
```json
{"category": "landscapes", "year": "2024"}
```
All conditions are AND'd.

### Single condition with operator
```json
{"field": "year", "op": "gt", "value": "2020"}
```

### Logical AND
```json
{
  "and": [
    {"field": "year", "op": "ge", "value": "2020"},
    {"field": "category", "op": "eq", "value": "landscapes"}
  ]
}
```

### Logical OR
```json
{
  "or": [
    {"field": "category", "op": "eq", "value": "landscapes"},
    {"field": "category", "op": "eq", "value": "urban"}
  ]
}
```

### Nested AND/OR
```json
{
  "and": [
    {
      "or": [
        {"field": "category", "op": "eq", "value": "landscapes"},
        {"field": "category", "op": "in", "value": ["urban", "portraits"]}
      ]
    },
    {"field": "year", "op": "ge", "value": "2020"}
  ]
}
```

### Filtering on joined tables
Use `tableName.columnName` dot notation:
```json
{"field": "categories.label", "op": "eq", "value": "Landscapes"}
```

### Operators

| Op | Description | Value type |
|---|---|---|
| `eq` | Equals | string, number, boolean |
| `ne` | Not equals | string, number, boolean |
| `lt` | Less than | string, number |
| `gt` | Greater than | string, number |
| `le` | Less than or equal | string, number |
| `ge` | Greater than or equal | string, number |
| `in` | Value in array | array |
| `like` | SQL LIKE pattern | string (use `%` for wildcards) |

---

## 8. Column Type Reference

| Type | Description | Use for |
|---|---|---|
| `text` | String/text data | Names, descriptions, URLs, enum values, any string |
| `float` | Floating point number | Prices, percentages, decimal quantities |
| `integer` | Whole number | Counts, IDs, foreign keys, quantities |
| `boolean` | True/false | Toggles, flags, active/inactive states |
| `date` | Date without time | Birth dates, due dates, YYYY-MM-DD values |
| `datetime` | Date with time | Timestamps, created_at, event times |
| `json` | JSON object/array | Nested data, flexible schemas, metadata |
| `blob` | Binary data | File content, images stored in DB |

Note: `id` column is auto-created for every table — do not include it.

---

## 9. Relation Reference

Relations are defined per-table in the `relations` array. The corresponding foreign key column
MUST also be defined in the `columns` array.

### Relation types

| Type | Meaning | Example |
|---|---|---|
| `many-to-one` | Many rows in this table → one row in target | Many trades → one portfolio |
| `one-to-many` | One row in this table → many in target | One portfolio → many trades |
| `one-to-one` | One row ↔ one row | One user → one profile |
| `many-to-many` | Many ↔ many (needs join table) | Items ↔ tags |

### Relation definition

```json
{
  "type": "many-to-one",
  "targetTable": "portfolios",
  "sourceColumn": "portfolio_id",
  "targetColumn": "id"
}
```

- `targetTable` — The table being referenced
- `sourceColumn` — The foreign key column in THIS table (must exist in `columns`)
- `targetColumn` — The column in the target table (usually `id`)

### How relations enable joins

Once defined, you can use `?join=portfolios` on the Records endpoint to automatically
resolve the relation and include the related table's columns in the response.
