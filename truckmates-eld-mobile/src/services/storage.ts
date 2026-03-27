import AsyncStorage from "@react-native-async-storage/async-storage"

export const storage = {
  async get<T>(key: string): Promise<T | null> {
    const raw = await AsyncStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  },
  async set<T>(key: string, value: T): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value))
  },
  async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(key)
  },
}
