import { execFile } from 'child_process'
import { basename } from 'path'
import { unlink } from 'fs/promises'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(__dirname, '..', 'scripts', 'run_vibevoice.sh')

class Queue {
  constructor() {
    this.jobs = []
    this.clients = {}
    this.processing = false
  }

  add(job) {
    job.status = 'pending'
    this.jobs.push(job)

    const position = this.jobs.filter(j => j.status === 'pending').length

    if (!this.processing) {
      this.processNext()
    }

    return position
  }

  async processNext() {
    const next = this.jobs.find(j => j.status === 'pending')
    if (!next) {
      this.processing = false
      return
    }

    this.processing = true
    next.status = 'processing'
    this._notify(next.id, { type: 'processing' })

    // Update queue positions for remaining pending jobs
    this.jobs
      .filter(j => j.status === 'pending')
      .forEach((job, i) => {
        this._notify(job.id, { type: 'queued', position: i + 1 })
      })

    try {
      await this._runScript(next.textFile, next.outputFile)
      next.status = 'done'
      next.url = `/output/${basename(next.outputFile)}`
      this._notify(next.id, { type: 'done', url: next.url })
    } catch (err) {
      console.error(`Job ${next.id} failed:`, err.message)
      next.status = 'error'
      this._notify(next.id, { type: 'error' })
    } finally {
      unlink(next.textFile).catch(() => {})
    }

    this.processNext()
  }

  _runScript(textFile, outputFile) {
    return new Promise((resolve, reject) => {
      execFile('bash', [SCRIPT, textFile, outputFile], { timeout: 300_000 }, (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message))
        else resolve(stdout)
      })
    })
  }

  registerClient(jobId, res) {
    if (!this.clients[jobId]) this.clients[jobId] = []
    this.clients[jobId].push(res)

    // Send current state immediately so late-connecting clients are caught up
    const job = this.jobs.find(j => j.id === jobId)
    if (!job) return

    if (job.status === 'done') {
      this._sendToClient(res, { type: 'done', url: job.url })
    } else if (job.status === 'error') {
      this._sendToClient(res, { type: 'error' })
    } else if (job.status === 'processing') {
      this._sendToClient(res, { type: 'processing' })
    } else {
      const pending = this.jobs.filter(j => j.status === 'pending')
      const position = pending.indexOf(job) + 1
      this._sendToClient(res, { type: 'queued', position })
    }
  }

  removeClient(jobId, res) {
    if (this.clients[jobId]) {
      this.clients[jobId] = this.clients[jobId].filter(r => r !== res)
    }
  }

  _notify(jobId, event) {
    const clients = this.clients[jobId] || []
    clients.forEach(res => this._sendToClient(res, event))
  }

  _sendToClient(res, data) {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    } catch (_) {}
  }
}

export default new Queue()
