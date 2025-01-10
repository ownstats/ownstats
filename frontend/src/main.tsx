import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initializeDuckDb } from "duckdb-wasm-kit";
import { DuckDBConfig } from "@duckdb/duckdb-wasm";
import { QueryFilterProvider } from './utils/QueryFilterProvider.tsx';
import { DataManagerProvider } from './utils/DataManagerProvider.tsx';

// Configure DuckDB-WASM
const config: DuckDBConfig = {
  query: {
    castBigIntToDouble: true,
    castDecimalToDouble: true,
  },
}

// Start initalization early
initializeDuckDb({ config, debug: false });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DataManagerProvider>
      <QueryFilterProvider>
        <App />
      </QueryFilterProvider>
    </DataManagerProvider>
  </React.StrictMode>,
)
