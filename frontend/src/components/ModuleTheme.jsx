import { createContext, useContext } from 'react'
import { MODULE_THEME, DEFAULT_THEME, moduleTheme, themeVars } from '../theme/moduleTheme'
import { moduleLabel } from '../utils/constants'

// Each module's colours come from theme/moduleTheme.js. `from`/`to` are kept
// for callers that still read a two-stop gradient.
export const MODULE_COLORS = Object.fromEntries(
  Object.entries(MODULE_THEME).map(([key, t]) => [key, { ...t, from: t.strong, to: t.dark }])
)

const ModuleThemeContext = createContext(null)

// `moduleName` is the module's label from constants.js (the app bar shows it).
// Also sets the CSS variables behind brandblue/brandnavy/brandsky, so every
// screen's section headers, primary buttons and links take the module colour.
// `module-themed` switches .bg-page to the module's own gradient (index.css).
// `display: contents` keeps the wrapper out of the layout.
export function ModuleThemeProvider({ module, children }) {
  const theme = moduleTheme(module)
  return (
    <ModuleThemeContext.Provider value={{ ...theme, from: theme.strong, to: theme.dark, moduleName: moduleLabel(module) }}>
      <div className="module-themed contents" style={themeVars(theme)}>
        {children}
      </div>
    </ModuleThemeContext.Provider>
  )
}

export function useModuleTheme() {
  return useContext(ModuleThemeContext) ?? { ...DEFAULT_THEME, from: DEFAULT_THEME.strong, to: DEFAULT_THEME.dark }
}
