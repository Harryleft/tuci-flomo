class StorageService {
  static async saveConfig(config) {
    return chrome.storage.local.set(config);
  }

  static async getConfig() {
    return chrome.storage.local.get();
  }

  static async saveWord(wordData) {
    const words = await this.getWords();
    words.push(wordData);
    return chrome.storage.local.set({ words });
  }

  static async getWords() {
    const result = await chrome.storage.local.get('words');
    return result.words || [];
  }
}

export default StorageService; 