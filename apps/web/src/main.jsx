import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { CompanyAuthProvider } from "./context/CompanyAuthContext";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CompanyAuthProvider>
          <WorkspaceProvider>
            <App />
          </WorkspaceProvider>
        </CompanyAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
