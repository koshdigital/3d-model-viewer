import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { protect } from './protect.js'
import './styles.css'

protect()
createRoot(document.getElementById('root')).render(<App />)
