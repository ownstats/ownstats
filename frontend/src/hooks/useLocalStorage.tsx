import { useState } from "react";

// See: https://stackoverflow.com/a/72299112/1603357
export function useLocalStorage<T>(key: string, value: T) {
  const [state, _setState] = useState<T>(localStorage.getItem(key) ? JSON.parse(localStorage.getItem(key)!) as T : value);

  function setStorage(value: T) {
    console.log(value);
    //_setState((_) => value as unknown as T);
    localStorage.setItem(key, JSON.stringify(value));
  }
  return [state, setStorage];
};
