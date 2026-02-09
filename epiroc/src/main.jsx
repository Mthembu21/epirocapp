// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { DirectionProvider } from './components/ui/direction.tsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DirectionProvider>
      <App />
    </DirectionProvider>
  </React.StrictMode>,
)