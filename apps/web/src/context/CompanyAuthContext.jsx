import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { companyLogin, companyLogout } from "../features/company/companyApi";

const CompanyAuthContext = createContext(null);

export function CompanyAuthProvider({ children }) {
  const [company, setCompany] = useState(() => {
    try {
      const savedCompany = localStorage.getItem("company");
      return savedCompany ? JSON.parse(savedCompany) : null;
    } catch {
      localStorage.removeItem("company");
      return null;
    }
  });
  const [authNotice, setAuthNotice] = useState("");

  const signIn = useCallback(async (credentials) => {
    const result = await companyLogin(credentials);
    if (!result?.user) {
      throw new Error("Company sign-in returned no company profile.");
    }
    localStorage.setItem("company", JSON.stringify(result.user));
    setCompany(result.user);
    setAuthNotice("");
    return result.user;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await companyLogout();
      setAuthNotice("");
    } catch (error) {
      setAuthNotice(
        `${error.message || "Unable to contact the sign-out service."} You have been signed out of this portal on this device.`,
      );
    } finally {
      localStorage.removeItem("company");
      setCompany(null);
    }
  }, []);

  const value = useMemo(
    () => ({ company, authNotice, signIn, signOut }),
    [company, authNotice, signIn, signOut],
  );

  return (
    <CompanyAuthContext.Provider value={value}>
      {children}
    </CompanyAuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCompanyAuth() {
  const context = useContext(CompanyAuthContext);
  if (!context) {
    throw new Error("useCompanyAuth must be used within CompanyAuthProvider.");
  }
  return context;
}
