import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Language } from "../types/accounts";
import { copy, type CopyKey } from "../data/copy";
import { ApiError } from "../api/client";

interface LanguageValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: CopyKey) => string;
  errorText: (error: unknown) => string;
}
const Context = createContext<LanguageValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      return localStorage.getItem("trainfuel.language") === "ar" ? "ar" : "en";
    } catch {
      return "en";
    }
  });
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    try {
      localStorage.setItem("trainfuel.language", language);
    } catch {
      /* Preference persistence is optional. */
    }
  }, [language]);
  function errorText(error: unknown) {
    if (error instanceof ApiError) {
      const code = error.data.code;
      const keys: Record<string, CopyKey> = {
        invalid_credentials: "invalidCredentials",
        email_exists: "emailExists",
        account_link_required: "linkRequired",
        identity_conflict: "identityConflict",
        invalid_google_challenge: "googleRetry",
        invalid_google_token: "googleRetry",
        google_unavailable: "googleUnavailable",
        invalid_reset_token: "invalidReset",
        revision_conflict: "profileConflict",
        reauthentication_required: "reauthenticate",
        already_authenticated: "alreadySignedIn",
      };
      if (typeof code === "string" && keys[code])
        return copy[language][keys[code]];
      if (error.status === 429) return copy[language].tooMany;
      if (error.status === 400)
        return language === "en" ? error.message : copy.ar.checkFields;
      if (error.status === 401 || error.status === 403)
        return copy[language].sessionExpired;
    }
    return copy[language].networkError;
  }
  return (
    <Context.Provider
      value={{
        language,
        setLanguage,
        t: (key) => copy[language][key],
        errorText,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useLanguage() {
  const context = useContext(Context);
  if (!context) throw new Error("LanguageProvider is missing");
  return context;
}
