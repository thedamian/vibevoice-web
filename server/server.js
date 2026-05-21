import express from 'express'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'
import queue from './queue.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const TEMP_DIR = join(ROOT, 'temp')
const OUTPUT_DIR = join(ROOT, 'output')

mkdirSync(TEMP_DIR, { recursive: true })
mkdirSync(OUTPUT_DIR, { recursive: true })

const app = express()
app.use(express.json({ limit: '10mb' }))

// Serve generated MP3s publicly
app.use('/output', express.static(OUTPUT_DIR))

// Serve built frontend in production
app.use(express.static(join(ROOT, 'dist')))

app.post('/api/submit', (req, res) => {
  const { text } = req.body
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Text is required' })
  }

  const id = randomUUID()
  const textFile = join(TEMP_DIR, `${id}.txt`)
  const outputFile = join(OUTPUT_DIR, `${id}.mp3`)

  writeFileSync(textFile, text.trim(), 'utf8')

  const position = queue.add({ id, textFile, outputFile })

  res.json({ jobId: id, position })
})

app.get('/api/events/:jobId', (req, res) => {
  const { jobId } = req.params

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  queue.registerClient(jobId, res)

  req.on('close', () => {
    queue.removeClient(jobId, res)
  })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
