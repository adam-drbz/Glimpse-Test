# Frontend-Backend Integration Instructions

## Project Overview

You are working with a Vite-React project that needs to be connected to a Python backend. The project follows this directory structure:

```
/root-dir
├── backend/
│   └── openapi.yaml
└── frontend/
    ├── config/
    └── react-app/
        └── src/
            └── api/
                └── py/
```

## Integration Requirements

Your task is to integrate the React frontend with the backend API by following a specific architecture pattern.

### Step 1: Refactor Data Access Layer

Refactor all data access in `./frontend/react-app/src` so that **all data operations** are performed through function calls located in `./frontend/react-app/src/api/`.

- Remove any direct data manipulation or hardcoded data from components
- Create clean API function interfaces in the `api/` directory
- Ensure all components consume data through these API functions

### Step 2: Initialize the App Backend

**CRITICAL FIRST STEP:** Before implementing any data operations, create `./frontend/react-app/src/api/py/init_app.py` to initialize the app backend with tables and seed data.

**Required:** Check module documentation first:
- **Endpoint:** `GET http://localhost:3000/api/v1/modules/dynamic_db`
- This returns the complete module interface with all available functions, parameters, and examples

**Pattern for `init_app.py`:**
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

**Key Requirements:**
1. Import: `from custom_modules import dynamic_db`
2. Create client: `client = dynamic_db.DynamicDBClient()`
3. Use `client.create_app(schema)` to initialize tables
4. Return the `appId` - you'll need it for all subsequent operations
5. Define a `run()` function that returns JSON-serializable data

### Step 3: Implement Backend Communication

Each API function must communicate with the backend using the execute-code endpoint.

**Execution Endpoint:**
- **URL:** `POST http://localhost:3000/api/v1/execute-code`
- **Request Body:**
  ```json
  {
    "code": "your_python_code_string",
    "modules": ["dynamic_db"],
    "input": {"app_id": "...", "other_params": "..."},
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

**Using `outputSchema` (Recommended):**
- The `outputSchema` field is **optional but highly recommended** for ensuring consistent output formatting
- It validates the `run()` function's return value against a JSON schema
- If the output doesn't match the schema, an error will be returned
- This helps catch formatting issues early and ensures type safety

**Example with outputSchema:**
```json
{
  "code": "from custom_modules import dynamic_db\n\ndef run(app_id):\n    client = dynamic_db.DynamicDBClient()\n    result = client.list_records(app_id, 'items')\n    return {'success': True, 'data': result['data']}",
  "modules": ["dynamic_db"],
  "input": {"app_id": "app_123"},
  "outputSchema": {
    "type": "object",
    "properties": {
      "success": {"type": "boolean"},
      "data": {
        "type": "array",
        "items": {"type": "object"}
      }
    },
    "required": ["success", "data"]
  }
}
```

**Module Information Endpoint:**
- **URL:** `GET http://localhost:3000/api/v1/modules/:moduleName`
- **Example:** `GET http://localhost:3000/api/v1/modules/dynamic_db`
- **Returns:** Complete module interface including:
  - Available functions (e.g., `create_app`, `list_records`, `create_record`)
  - Function signatures with parameters and types
  - Return value structures
  - Usage examples

**IMPORTANT:** Always check the module endpoint before writing Python code to ensure you use the correct function names, parameters, and return types.

**Python Code Requirements:**
1. **Must define a `run()` function** (sync or async)
2. **Import format:** `from custom_modules import dynamic_db`
3. **Create client instance:** `client = dynamic_db.DynamicDBClient()`
4. **Accept input parameters:** Use the `run()` function parameters (e.g., `def run(app_id, item_id)`)
5. **Return JSON-serializable data:** Dict, list, string, number, boolean
6. **Match the `outputSchema`:** Ensure your return value conforms to the schema you define in the request

**API Documentation:** Reference `./backend/openapi.yaml` for complete endpoint specifications.

The backend executes Python code dynamically, so your API functions will:
1. Load Python code from the `api/py/` directory
2. Send it to the backend via the execute-code endpoint
3. Pass input parameters through the `input` field
4. Handle the responses appropriately

### Step 4: Organize Python Code

Store all Python code snippets in `./frontend/react-app/src/api/py/`:

- Create separate Python files for different data operations
- Follow a logical naming convention (e.g., `init_app.py`, `list_items.py`, `create_item.py`, `get_item.py`)
- Ensure Python code is modular and reusable
- Include proper error handling in the Python snippets
- Always use `from custom_modules import dynamic_db` for imports
- Always create a `DynamicDBClient` instance in each script
- Accept necessary parameters (especially `app_id`) through the `run()` function

**Example: Complete API Function with `outputSchema`**

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

## Common Pitfalls and How to Avoid Them

### 1. Incorrect Import Statement
❌ **WRONG:**
```python
import dynamic_db
```
✅ **CORRECT:**
```python
from custom_modules import dynamic_db
```

### 2. Missing DynamicDBClient Instance
❌ **WRONG:**
```python
def run(app_id):
    return dynamic_db.list_records(app_id, 'items')  # Won't work!
```
✅ **CORRECT:**
```python
def run(app_id):
    client = dynamic_db.DynamicDBClient()
    return client.list_records(app_id, 'items')
```

### 3. Missing `run()` Function
❌ **WRONG:**
```python
from custom_modules import dynamic_db

client = dynamic_db.DynamicDBClient()
result = client.list_records(app_id, 'items')
```
✅ **CORRECT:**
```python
from custom_modules import dynamic_db

def run(app_id):
    client = dynamic_db.DynamicDBClient()
    return client.list_records(app_id, 'items')
```

### 4. Not Checking Module Documentation
❌ **WRONG:** Guessing function names and parameters
✅ **CORRECT:** Always check `GET http://localhost:3000/api/v1/modules/dynamic_db` first

### 5. Forgetting to Pass `app_id`
❌ **WRONG:**
```python
def run():
    client = dynamic_db.DynamicDBClient()
    return client.list_records('items')  # Missing app_id!
```
✅ **CORRECT:**
```python
def run(app_id):
    client = dynamic_db.DynamicDBClient()
    return client.list_records(app_id, 'items')
```

### 6. Not Handling Errors
❌ **RISKY:**
```python
def run(app_id):
    client = dynamic_db.DynamicDBClient()
    return client.list_records(app_id, 'items')  # Will crash on error
```
✅ **BETTER:**
```python
def run(app_id):
    try:
        client = dynamic_db.DynamicDBClient()
        result = client.list_records(app_id, 'items')
        return {'success': True, 'data': result['data']}
    except Exception as e:
        return {'success': False, 'error': str(e)}
```

### 7. Not Using `outputSchema` for Validation
❌ **MISSING VALIDATION:**
```json
{
  "code": "...",
  "modules": ["dynamic_db"],
  "input": {"app_id": "app_123"}
}
```
✅ **WITH VALIDATION:**
```json
{
  "code": "...",
  "modules": ["dynamic_db"],
  "input": {"app_id": "app_123"},
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

**Why use `outputSchema`:**
- Ensures your Python code returns the expected structure
- Catches type mismatches early (e.g., returning a string instead of an array)
- Provides clear error messages when the output doesn't match
- Acts as documentation for what the endpoint returns
- Helps TypeScript/frontend code rely on consistent data shapes

## Expected Outcome

After completing this integration:
- The app backend will be initialized with tables and seed data via `init_app.py`
- The frontend will have a clean separation between UI and data layers
- All backend communication will be centralized in the `api/` directory
- Python code will be organized and maintainable in the `api/py/` directory
- All Python scripts will:
  - Use correct imports: `from custom_modules import dynamic_db`
  - Create DynamicDBClient instances: `client = dynamic_db.DynamicDBClient()`
  - Define a `run()` function that accepts input parameters
  - Return values that match the defined `outputSchema`
  - Use the correct module functions (verified from `GET /api/v1/modules/dynamic_db`)
- The application will properly communicate with the backend via the `POST /api/v1/execute-code` endpoint
- All API calls will use `outputSchema` to validate responses and ensure consistent data formatting
