export const IPC = {
  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Windows
  OPEN_FLOATING: 'window:open-floating',
  CLOSE_FLOATING: 'window:close-floating',
  OPEN_SETTINGS: 'window:open-settings',
  MOVE_WINDOW: 'window:move-window',
  SET_RESIZABLE: 'window:set-resizable',

  // Relay stats → floating window
  RELAY_STATS: 'relay:stats',
  RELAY_ERROR: 'relay:error',
  RELAY_STATS_CURRENT: 'relay:stats-current',

  // Relay control (from settings UI)
  RELAY_START: 'relay:start',
  RELAY_STOP: 'relay:stop',
  RELAY_STATUS: 'relay:status',

  // Auto start
  AUTOSTART_GET: 'autostart:get',
  AUTOSTART_SET: 'autostart:set',

  // Config profiles
  CONFIGS_LIST: 'configs:list',
  CONFIGS_SAVE: 'configs:save',
  CONFIGS_DELETE: 'configs:delete',
  CONFIGS_LOAD: 'configs:load',

  // Style config
  STYLE_GET: 'style:get',
  STYLE_SET: 'style:set',

  // Background image
  BACKGROUND_SELECT_IMAGE: 'background:select-image',
  BACKGROUND_GET_PRESETS: 'background:get-presets',

  // Session logs
  LOGS_LIST: 'logs:list',

  // App
  APP_QUIT: 'app:quit'
} as const
