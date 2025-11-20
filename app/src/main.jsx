import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { WalletConnectionProvider } from './WalletConnectionProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <WalletConnectionProvider>
        <App />
      </WalletConnectionProvider>
    </BrowserRouter>
  </StrictMode>
)
