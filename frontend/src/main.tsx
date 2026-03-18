// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'

// Configure React Query with sensible defaults for a live-data dashboard
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Show stale data for 60s before refetching in the background
      staleTime: 60_000,
      // Keep unused query data for 5 minutes
      gcTime: 5 * 60_000,
      // Retry failed requests twice with exponential backoff
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
      // Don't refetch on window focus — avoid noise in a dashboard context
      refetchOnWindowFocus: false,
      // Auto-refetch every 5 minutes to keep data fresh
      refetchInterval: 5 * 60_000,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
