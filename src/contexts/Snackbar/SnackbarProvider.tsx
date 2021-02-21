import React, {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useState,
  useEffect
} from 'react'
import { v4 as uuid } from 'uuid'
import SnackbarContainer from './SnackbarContainer'
import Snackbar from './Snackbar'

type Alert =  {
  key: string
  message: string
}

type SnackbarContext = {
  addAlert: (alert: Alert) => void
}

type SnackbarProviderProps = {
  children: React.ReactNode
  duration?: number
}

const SnackbarContext = createContext<SnackbarContext>(undefined!)

export function useSnackbarContext() {
  return useContext(SnackbarContext)
}

export default function SnackbarProvider(props: SnackbarProviderProps): JSX.Element {
  const { children, duration = 15000 } = props

  const [alerts, setAlerts] = useState<Alert[]>([])
  useEffect(() => {
    if (alerts.length > 0) {
      const timer = setTimeout(() => setAlerts((alerts) => alerts.slice(0, alerts.length - 1)), duration)
      return () => clearTimeout(timer)
    }
  }, [alerts, duration])

  // add alert
  const addAlert = useCallback(
    (alert: Alert) => setAlerts((alerts: Alert[]) => [alert, ...alerts]),
    [],
  )

  // TODO:
  // remove alert

  const value = useMemo(() => ({ addAlert }), [addAlert])
  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <SnackbarContainer>
        {alerts.map((alert, index) => (
          <Snackbar
            key={`${alert.key}`}
          >
            {alert.message}
          </Snackbar>
        ))}
      </SnackbarContainer>
    </SnackbarContext.Provider>
  )
}

 export function useSnackbar() {
   const { addAlert } = useSnackbarContext()

   const enqueueSnackbar = useCallback((message) => {
     addAlert({
       key: uuid(),
       message,
      })
   }, [addAlert])

  return { enqueueSnackbar }
 }
