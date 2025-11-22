import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { WalletConnectionProvider } from './WalletConnectionProvider.jsx'
import { DidProvider } from './context/DidContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <WalletConnectionProvider>
        <DidProvider>
          <App />
        </DidProvider>
      </WalletConnectionProvider>
    </BrowserRouter>
  </StrictMode>
)
