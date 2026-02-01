# Frontend-Backend Integration Instructions

## Overview

Integrate a Vite-React frontend with a Python backend using dynamic code execution. The backend executes Python scripts that interact with a dynamic database via the `dynamic_db` module.

**Directory Structure:**
```
/root-dir
├── backend/
│   └── openapi.yaml
└── frontend/
    └── react-app/
        └── src/
            └── api/
                ├── py/          # Python scripts
                └── *.ts         # TypeScript API functions
```

## Prerequisites

**Check Module Documentation First:**
- `GET http://localhost:3000/api/v1/modules/dynamic_db`
- Returns available functions, parameters, return types, and examples
- **Always verify function signatures before writing Python code**

## Implementation Steps

### Step 1: Refactor Data Access Layer

Move all data operations from components to `./frontend/react-app/src/api/`:
- Remove hardcoded data and direct manipulation from components
- Create clean API function interfaces
- Components only call API functions, never access data directly

### Step 2: Initialize App Backend

**CRITICAL:** Create `./frontend/react-app/src/api/py/init_app.py` first to set up database tables and seed data.

**Template:**
```python
from custom_modules import dynamic_db

def run():
    """Initialize app with tables and seed data"""
    # Create client instance
    client = dynamic_db.DynamicDBClient()

    # Define schema with tables
    schema = {
        'tables': [
            {
                'name': 'your_table_name',
                'displayName': 'Your Table',
                'columns': [
                    {'name': 'field1', 'type': 'text', 'required': True},
                    {'name': 'field2', 'type': 'text'}
                ]
            }
        ]
    }

    # Create app and get appId
    result = client.create_app(schema)
    app_id = result['appId']

    # Seed initial data (optional)
    client.create_record(app_id, 'your_table_name', {'field1': 'value1'})

    return {
        'success': True,
        'appId': app_id,
        'tablesCreated': result['tablesCreated']
    }
```

**Requirements:**
1. Define `run()` function (sync or async)
2. Import: `from custom_modules import dynamic_db`
3. Create client: `client = dynamic_db.DynamicDBClient()`
4. Call `client.create_app(schema)` to create tables
5. Return the `appId` for all subsequent operations

### Step 3: Implement Backend Communication

**Endpoint:** `POST http://localhost:3000/api/v1/execute-code`

**Request Format:**
```json
{
  "code": "your_python_code_string",
  "modules": ["dynamic_db"],
  "input": {"app_id": "...", "param": "..."},
  "outputSchema": {
    "type": "object",
    "properties": {
      "success": {"type": "boolean"},
      "data": {"type": "array"}
    },
    "required": ["success", "data"]
  }
}
```

**Python Code Requirements:**
1. Must define a `run()` function (sync or async) that accepts input parameters
2. Import: `from custom_modules import dynamic_db`
3. Create client: `client = dynamic_db.DynamicDBClient()`
4. Return JSON-serializable data matching `outputSchema`
5. Handle errors with try-except blocks

**Using `outputSchema` (Strongly Recommended):**
- Validates return value against JSON schema
- Catches type mismatches early
- Provides clear error messages
- Ensures consistent data shapes for TypeScript

**API Flow:**
1. Load Python code from `./frontend/react-app/src/api/py/`
2. POST to execute-code endpoint with code, modules, input, and outputSchema
3. Backend executes code and validates output
4. Handle response in TypeScript

### Step 4: Organize Python Scripts

Create separate `.py` files in `./frontend/react-app/src/api/py/`:
- `init_app.py` - Initialize database
- `list_items.py`, `get_item.py`, `create_item.py`, `update_item.py`, `delete_item.py`

**Each script must:**
- Define a `run()` function with input parameters
- Import: `from custom_modules import dynamic_db`
- Create client: `client = dynamic_db.DynamicDBClient()`
- Include try-except error handling
- Return JSON matching the outputSchema

**Complete Example:**

**Python file:** `./frontend/react-app/src/api/py/list_items.py`
```python
from custom_modules import dynamic_db

def run(app_id, limit=100, offset=0):
    """List items with pagination"""
    try:
        client = dynamic_db.DynamicDBClient()
        result = client.list_records(
            app_id=app_id,
            table_name='items',
            limit=limit,
            offset=offset
        )
        return {
            'success': True,
            'data': result['data'],
            'pagination': result['pagination']
        }
    except Exception as e:
        return {
            'success': False,
            'data': [],
            'error': str(e)
        }
```

**TypeScript API function:** `./frontend/react-app/src/api/listItems.ts`
```typescript
interface ListItemsResponse {
  success: boolean;
  data: Array<{
    id: number;
    [key: string]: any;
  }>;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
  };
  error?: string;
}

export async function listItems(
  appId: string,
  limit = 100,
  offset = 0
): Promise<ListItemsResponse> {
  const pythonCode = await fetch('/api/py/list_items.py').then(r => r.text());

  const response = await fetch('http://localhost:3000/api/v1/execute-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: pythonCode,
      modules: ['dynamic_db'],
      input: { app_id: appId, limit, offset },
      outputSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'array',
            items: { type: 'object' }
          },
          pagination: {
            type: 'object',
            properties: {
              total: { type: 'number' },
              limit: { type: 'number' },
              offset: { type: 'number' }
            }
          },
          error: { type: 'string' }
        },
        required: ['success', 'data']
      }
    })
  });

  const result = await response.json();

  if (result.status === 'success') {
    return result.output;
  } else {
    throw new Error(result.error || 'Execution failed');
  }
}
```

## Common Mistakes to Avoid

| ❌ Wrong | ✅ Correct |
|---------|----------|
| `import dynamic_db` | `from custom_modules import dynamic_db` |
| `dynamic_db.list_records(...)` | `client = dynamic_db.DynamicDBClient()`<br>`client.list_records(...)` |
| No `run()` function | Always define `def run(...)` |
| Guessing function names | Check `GET /api/v1/modules/dynamic_db` first |
| `def run():` | `def run(app_id):` - Always pass `app_id` |
| No error handling | Wrap in `try-except` blocks |
| No `outputSchema` | Always include `outputSchema` for validation |

**Critical Rules:**
1. **Always** import as `from custom_modules import dynamic_db`
2. **Always** create client: `client = dynamic_db.DynamicDBClient()`
3. **Always** define a `run()` function with parameters
4. **Always** use try-except for error handling
5. **Always** include `outputSchema` in API calls
6. **Always** check module docs before writing code

## Success Criteria

✓ Backend initialized with tables and seed data (`init_app.py`)
✓ Clean separation: Components → API functions → Python scripts → Backend
✓ All Python scripts follow the 6 critical rules above
✓ All API calls include `outputSchema` for type safety
✓ Error handling in place for all operations
✓ TypeScript types match Python return structures

## Quick Reference

**Python Script Template:**
```python
from custom_modules import dynamic_db

def run(app_id, param1, param2=None):
    try:
        client = dynamic_db.DynamicDBClient()
        result = client.some_function(app_id, param1)
        return {'success': True, 'data': result}
    except Exception as e:
        return {'success': False, 'error': str(e)}
```

**TypeScript API Call Template:**
```typescript
const response = await fetch('http://localhost:3000/api/v1/execute-code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    code: pythonCode,
    modules: ['dynamic_db'],
    input: { app_id: appId, param1: value },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'array' }
      },
      required: ['success', 'data']
    }
  })
});
```

**Key Endpoints:**
- Module docs: `GET http://localhost:3000/api/v1/modules/dynamic_db`
- Execute code: `POST http://localhost:3000/api/v1/execute-code`
- API spec: `./backend/openapi.yaml`
