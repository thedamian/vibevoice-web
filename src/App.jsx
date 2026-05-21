import { useState, useRef } from 'react'
import './App.css'

export default function App() {
  const [text, setText] = useState('')
  const [status, setStatus] = useState(null)
  const [position, setPosition] = useState(null)
  const [mp3Url, setMp3Url] = useState(null)
  const esRef = useRef(null)

  async function handleSubmit() {
    if (!text.trim()) return

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      if (!res.ok) {
        setStatus('error')
        return
      }

      const { jobId, position: pos } = await res.json()
      setPosition(pos)
      setStatus('queued')

      const es = new EventSource(`/api/events/${jobId}`)
      esRef.current = es

      es.onmessage = (e) => {
        const msg = JSON.parse(e.data)
        if (msg.type === 'queued') {
          setPosition(msg.position)
          setStatus('queued')
        } else if (msg.type === 'processing') {
          setStatus('processing')
        } else if (msg.type === 'done') {
          setMp3Url(msg.url)
          setStatus('done')
          es.close()
        } else if (msg.type === 'error') {
          setStatus('error')
          es.close()
        }
      }

      es.onerror = () => {
        setStatus('error')
        es.close()
      }
    } catch {
      setStatus('error')
    }
  }

  function reset() {
    esRef.current?.close()
    setText('')
    setStatus(null)
    setPosition(null)
    setMp3Url(null)
  }

  return (
    <div className="container">
      <h1>VibeVoice</h1>
      <p className="subtitle">Turn your script into a two-voice audio experience</p>

      {!status && (
        <div className="form">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your script or transcript here. Use a new paragraph or speaker labels to indicate voice changes..."
            rows={18}
          />
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={!text.trim()}
          >
            Generate Audio
          </button>
        </div>
      )}

      {status === 'queued' && (
        <div className="status-card">
          <div className="spinner" />
          <h2>You're in the queue</h2>
          <p>
            Position <strong>{position}</strong> — your request will be processed shortly.
          </p>
        </div>
      )}

      {status === 'processing' && (
        <div className="status-card">
          <div className="spinner active" />
          <h2>Generating your audio...</h2>
          <p>This may take a moment depending on the length of your script.</p>
        </div>
      )}

      {status === 'done' && (
        <div className="status-card done">
          <div className="check">✓</div>
          <h2>Your audio is ready!</h2>
          <audio controls src={mp3Url} />
          <div className="actions">
            <a href={mp3Url} download className="btn-primary">
              Download MP3
            </a>
            <button className="btn-secondary" onClick={reset}>
              Submit another
            </button>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="status-card error">
          <div className="x">✕</div>
          <h2>Something went wrong</h2>
          <p>There was an error processing your request.</p>
          <button className="btn-secondary" onClick={reset}>
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
