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

### Step 2: Implement Backend Communication

Each API function must communicate with the backend using the following specifications:

- **Endpoint:** `POST http://localhost:3000/api/v1/execute-code`
- **Required modules:** `["dynamic_db"]`
- **API Documentation:** Reference `./backend/openapi.yaml` for complete endpoint specifications

The backend executes Python code dynamically, so your API functions will:
1. Generate Python code snippets
2. Send them to the backend for execution
3. Handle the responses appropriately

### Step 3: Organize Python Code

Store all Python code snippets in `./frontend/react-app/src/api/py/`:

- Create separate Python files for different data operations
- Follow a logical naming convention (e.g., `get_items.py`, `create_user.py`)
- Ensure Python code is modular and reusable
- Include proper error handling in the Python snippets

## Expected Outcome

After completing this integration:
- The frontend will have a clean separation between UI and data layers
- All backend communication will be centralized in the `api/` directory
- Python code will be organized and maintainable in the `api/py/` directory
- The application will properly communicate with the backend via the `api/v1/execute-code` endpoint
