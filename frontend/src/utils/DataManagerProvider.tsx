import { PropsWithChildren, createContext, useContext } from 'react';

type ContextType = {
  isLoaded: () => boolean;
  setIsLoaded: (isLoaded: boolean) => void;
  isDatabaseAttached: () => boolean;
  setIsDatabaseAttached: (isDatabaseAttached: boolean) => void;
  isStreamLoaded: () => boolean;
  setIsStreamLoaded: (isStreamLoaded: boolean) => void;
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

  const isDatabaseAttached = (): boolean => {
    return JSON.parse(localStorage.getItem('databaseAttachedFlag') || "false");
  }

  const setIsDatabaseAttached = (isDatabaseAttached: boolean) => {
    localStorage.setItem('databaseAttachedFlag', isDatabaseAttached.toString());
  }

  const isStreamLoaded = (): boolean => {
    return JSON.parse(localStorage.getItem('streamLoadedFlag') || "false");
  }

  const setIsStreamLoaded = (isStreamLoaded: boolean) => {
    localStorage.setItem('streamLoadedFlag', isStreamLoaded.toString());
  }

  return (
    <DataManagerContext.Provider value={{ isLoaded, setIsLoaded, isDatabaseAttached, setIsDatabaseAttached, isStreamLoaded, setIsStreamLoaded }}>
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
