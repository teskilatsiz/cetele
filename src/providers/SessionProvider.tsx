import {
  createContext,
  useContext,
  useMemo,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

interface SessionContextValue {
  isAuthenticated: boolean;
  setIsAuthenticated: Dispatch<SetStateAction<boolean>>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface SessionProviderProps extends SessionContextValue {
  children: ReactNode;
}

export function SessionProvider({
  children,
  isAuthenticated,
  setIsAuthenticated,
}: SessionProviderProps) {
  const value = useMemo(
    () => ({ isAuthenticated, setIsAuthenticated }),
    [isAuthenticated, setIsAuthenticated]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }

  return context;
}
