import { useState } from 'react'
import './App.css'
import AudioRecord from './pages/audioRecord'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
    <AudioRecord />
    </>
  )
}

export default App
