import { createContext, useContext } from 'react';

interface TabBarVisibilityContextValue {
  isTabBarHidden: boolean;
  setTabBarHidden: (hidden: boolean) => void;
  acquireTabBarHidden: () => () => void;
}

export const TabBarVisibilityContext = createContext<TabBarVisibilityContextValue>({
  isTabBarHidden: false,
  setTabBarHidden: () => {},
  acquireTabBarHidden: () => () => {},
});

export function useTabBarVisibility() {
  return useContext(TabBarVisibilityContext);
}
