import type React from "react";
import { createContext, useCallback, useContext, useState } from "react";

// Shared current profile state across all useAuth instances
interface CurrentProfileContextType {
  currentProfileId: string | null;
  setCurrentProfileId: (id: string | null) => void;
  hasSetInitialProfile: boolean;
  setHasSetInitialProfile: (value: boolean) => void;
}

const CurrentProfileContext = createContext<CurrentProfileContextType | null>(
  null,
);

// The profile chosen last, kept in this browser so a reload acts as the same
// profile instead of falling back to the primary one.
const STORAGE_KEY = "commung-current-profile";

function readStoredProfileId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeProfileId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function CurrentProfileProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentProfileId, setProfileIdState] = useState<string | null>(
    readStoredProfileId,
  );
  const [hasSetInitialProfile, setHasSetInitialProfile] = useState(false);

  const setCurrentProfileId = useCallback((id: string | null) => {
    setProfileIdState(id);
    storeProfileId(id);
  }, []);

  return (
    <CurrentProfileContext.Provider
      value={{
        currentProfileId,
        setCurrentProfileId,
        hasSetInitialProfile,
        setHasSetInitialProfile,
      }}
    >
      {children}
    </CurrentProfileContext.Provider>
  );
}

export function useCurrentProfileState() {
  const context = useContext(CurrentProfileContext);
  if (!context) {
    throw new Error(
      "useCurrentProfileState must be used within CurrentProfileProvider",
    );
  }
  return context;
}
