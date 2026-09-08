import { useState } from 'react'
import { CaptureScreen } from './capture/CaptureScreen'
import { RegisterScreen } from './register/RegisterScreen'

type Screen = 'capture' | 'register'

function App() {
  // Capture renders first, always — the map is the first thing on screen.
  const [screen, setScreen] = useState<Screen>('capture')

  if (screen === 'register') {
    return <RegisterScreen onBack={() => setScreen('capture')} />
  }

  return <CaptureScreen onOpenRegister={() => setScreen('register')} />
}

export default App
