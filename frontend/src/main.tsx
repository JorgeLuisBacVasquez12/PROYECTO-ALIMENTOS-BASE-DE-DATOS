import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "./lib/i18n";
import "./styles/index.css";
import App from "./app/App";
import { config } from "./config/app";
import { ApiError } from "./lib/api";
const client = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000,
      gcTime: 60000,
      refetchOnWindowFocus: true,
      retry: (count, error) =>
        !(
          error instanceof ApiError &&
          error.status >= 400 &&
          error.status < 500
        ) && count < 1,
    },
    mutations: { retry: false },
  },
});
document.title = `${config.appName} · ${config.shortName}`;
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
