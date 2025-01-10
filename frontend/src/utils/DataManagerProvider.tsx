import { PropsWithChildren, createContext, useContext } from 'react';

type ContextType = {
  isLoaded: () => boolean;
  setIsLoaded: (isLoaded: boolean) => void;
};

export const DataManagerContext = createContext<ContextType | undefined>(undefined);
 
export const DataManagerProvider = ({ children }: PropsWithChildren<{}>) => {

  const isLoaded = (): boolean => {
    try {
      return JSON.parse(localStorage.getItem('remoteDataLoadedFlag') || "false");
    } catch (_e: any) {
      return false;
    }
  }

  const setIsLoaded = (isLoaded: boolean) => {
    localStorage.setItem('remoteDataLoadedFlag' , isLoaded.toString())
  }

  return (
    <DataManagerContext.Provider value={{ isLoaded, setIsLoaded }}>
      {children}
    </DataManagerContext.Provider>
  );
};
 
export const useDataManager = () => {
  const context = useContext(DataManagerContext);
 
  if (!context) {
    throw new Error('useDataManager must be used inside the DataManagerProvider');
  }
 
  return context;
};
