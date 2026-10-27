import type React from "react";
import type { ReactNode } from "react";
import { createContext, useContext } from "react";

interface UnreadCountContextType {
  refreshUnreadCounts: () => void;
  isHeaderVisible: boolean;
}

const UnreadCountContext = createContext<UnreadCountContextType | undefined>(
  undefined,
);

export const useUnreadCount = () => {
  const context = useContext(UnreadCountContext);
  if (context === undefined) {
    throw new Error(
      "useUnreadCount must be used within an UnreadCountProvider",
    );
  }
  return context;
};

interface UnreadCountProviderProps {
  children: ReactNode;
  refreshUnreadCounts: () => void;
  isHeaderVisible: boolean;
}

export const UnreadCountProvider: React.FC<UnreadCountProviderProps> = ({
  children,
  refreshUnreadCounts,
  isHeaderVisible,
}) => {
  return (
    <UnreadCountContext.Provider
      value={{ refreshUnreadCounts, isHeaderVisible }}
    >
      {children}
    </UnreadCountContext.Provider>
  );
};
