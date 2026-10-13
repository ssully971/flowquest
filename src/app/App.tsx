import { HomeScreen } from '@/features/home/HomeScreen'
import { FocusScreen } from '@/features/timer/FocusScreen'

import { AppShell } from './AppShell'
import { useAppMode } from './useAppMode'

export function App() {
  const [mode, setMode] = useAppMode()

  return (
    <AppShell mode={mode} onModeChange={setMode}>
      {mode === 'home' ? <HomeScreen /> : <FocusScreen />}
    </AppShell>
  )
}
