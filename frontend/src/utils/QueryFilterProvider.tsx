import { PropsWithChildren, createContext, useContext, useState } from 'react';

type QueryFilterEntry = {
  columnName: string;
  value: string;
}

export type QueryFilter = {
  [groupId: string]: QueryFilterEntry
};
 
type ContextType = {
  filter: QueryFilter;
  setFilter: (filter: QueryFilter) => void;
};

export const QueryFilterContext = createContext<ContextType | undefined>(undefined);
 
export const QueryFilterProvider = ({ children }: PropsWithChildren<{}>) => {
  const [filter, _setFilter] = useState<QueryFilter>(JSON.parse(localStorage.getItem('queryFilter') || '{}') as QueryFilter);

  const setFilter = (queryFilter: QueryFilter) => {
    _setFilter((_old) => queryFilter);
    localStorage.setItem('queryFilter' , JSON.stringify(queryFilter))
  }

  return (
    <QueryFilterContext.Provider value={{ filter, setFilter }}>
      {children}
    </QueryFilterContext.Provider>
  );
};
 
export const useQueryFilter = () => {
  const context = useContext(QueryFilterContext);
 
  if (!context) {
    throw new Error('useQueryFilter must be used inside the QueryFilterProvider');
  }
 
  return context;
};
