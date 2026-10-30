export const PRODUCT_NAME = 'A14 Pomodoro'
/** Persisted compatibility namespace. These are file formats/identities, not display names. */
export const DATA_IDENTITY = {
  profile:'Learnalyt',database:'learnalyt.db',demoDatabase:'learnalyt-demo.db',
  dataOverride:'LEARNALYT_DATA_DIR',appearanceFormat:'learnalyt-appearance',obsidianMarker:'learnalyt',
  drawingPrefixes:['A14 Pomodoro','A14Pomodoro','FocusRecall','Learnalyt','Trifocus']
} as const
/** Compatibility identities only. Never migrate or rename a real profile implicitly. */
export const LEGACY_IDENTITY = {
  appId:'app.trifocus.desktop',profile:'trifocus',database:'trifocus.db',demoDatabase:'trifocus-demo.db',dataOverride:'TRIFOCUS_DATA_DIR'
} as const
/** Test builds must not claim the installed application's taskbar/shortcut identity. */
export const QA_APP_ID = 'app.focusrecall.qa'
export const runtimeAppId = (qa: boolean): string => qa ? QA_APP_ID : LEGACY_IDENTITY.appId
export const isOwnAppProcess = (name:string):boolean => ['a14pomodoro','a14 pomodoro','focusrecall','learnalyt',LEGACY_IDENTITY.profile].includes(name.toLowerCase().replace(/\.exe$/,''))
