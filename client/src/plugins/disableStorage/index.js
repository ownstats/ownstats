export default function disableStoragePlugin () {
  return {
    name: 'disable-storage',
    setItemStart: ({ payload }) => {
      return {
        ...payload,
        ...{ options: { storage: 'global' } }
      }
    }
  }
}
