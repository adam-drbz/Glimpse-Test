Connect this vite-react project to a backend

This react project has the following stucture:
/root-dir
├── backend
└── frontend
    ├── config
    └── react-app
        ├── src/

Steps and instructions to connect to the backend:
1. refactor the ./frontend/react-app/src so that all data are accessed via function calls in ./frontend/react-app/src/api/
2. each function call must be implemented by calling the endpoint POST http://localhost:5021/v1/execute-code. You will use the modules: ["dynamic_db"]. The complete api documentation is given by ./backend/openapi.yaml
3. This means you will generate a python code and run. You will write python codes in ./frontend/react-app/src/api/py/
