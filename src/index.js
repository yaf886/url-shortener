// src/index.js — versi lengkap final
// src/index.js
import 'dotenv/config'
import express from 'express'
import { fileURLToPath } from 'url'   // ← tambah
import { dirname, join } from 'path'  // ← tambah
import db from './database.js'
import router from './routes.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use(router)

// ── Serve playground UI ────────────────────────────────────────────────────
app.get('/playground', (req, res) => {
  res.sendFile(join(__dirname, 'playground.html'))
})

// ── 404 & Error Handler (tetap sama seperti sebelumnya) ────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Endpoint '${req.method} ${req.path}' tidak ditemukan` })
})

app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err)
  res.status(500).json({
    success: false,
    error: 'Terjadi kesalahan di server',
    ...(process.env.NODE_ENV === 'development' && { detail: err.message })
  })
})

app.listen(PORT, () => {
  console.log(`🚀 Server jalan di http://localhost:${PORT}`)
  console.log(`🎮 Playground: http://localhost:${PORT}/playground`)
})

export { app, db }
