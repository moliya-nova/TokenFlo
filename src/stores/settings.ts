import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RelaySettings } from '../shared/relay-types'
import { DEFAULT_RELAY_SETTINGS } from '../shared/relay-types'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<RelaySettings>({ ...DEFAULT_RELAY_SETTINGS })

  async function load() {
    const s = await window.electronAPI.getSettings()
    if (s && s.models) {
      settings.value = s
    }
  }

  async function save() {
    await window.electronAPI.setSettings(settings.value)
  }

  return { settings, load, save }
})
