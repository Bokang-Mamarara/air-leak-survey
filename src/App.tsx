import { useState } from 'react'
import { CaptureScreen } from './capture/CaptureScreen'
import { RegisterScreen } from './register/RegisterScreen'
import { SettingsScreen } from './settings/SettingsScreen'
import { useCalcSettings } from './settings/useCalcSettings.ts'

type Screen = 'capture' | 'register' | 'settings'

function App() {
  // Capture renders first, always — the map is the first thing on screen.
  const [screen, setScreen] = useState<Screen>('capture')
  const { settings, tariffDraft, setSettings, setSettingsAndTariffDraft } = useCalcSettings()

  if (screen === 'settings') {
    return (
      <SettingsScreen
        settings={settings}
        tariffDraft={tariffDraft}
        onChangeSettings={setSettings}
        onChangeSettingsAndTariffDraft={setSettingsAndTariffDraft}
        onBack={() => setScreen('register')}
      />
    )
  }

  if (screen === 'register') {
    return (
      <RegisterScreen
        settings={settings}
        onBack={() => setScreen('capture')}
        onOpenSettings={() => setScreen('settings')}
      />
    )
  }

  return <CaptureScreen onOpenRegister={() => setScreen('register')} />
}

export default App
