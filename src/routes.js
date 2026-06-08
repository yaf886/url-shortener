// src/routes.js
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { Router } from 'express'
import db from './database.js'
import { generateCode, isValidUrl, getExpiryDate } from './helpers.js'


const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const router = Router()

// ── Playground UI ─────────────────────────────────────────────────────────────
router.get('/playground', (req, res) => {
  const html = readFileSync(join(__dirname, 'playground.html'), 'utf-8')
  res.setHeader('Content-Type', 'text/html')
  res.send(html)
})



// ════════════════════════════════════════════════════════════════════════════
// ROUTE 1 — POST /api/shorten
// Tugas: terima URL panjang, simpan ke DB, kembalikan short URL
// Analogi: kasir yang menerima titipan dan kasih nomor loker
// ════════════════════════════════════════════════════════════════════════════
router.post('/api/shorten', (req, res) => {
    if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'Request body tidak valid. Pastikan Content-Type: application/json'
    })
  }
  const { url, expiresInDays } = req.body

  // ── Validasi input ─────────────────────────────────────────────────────
  // Jangan pernah percaya input dari user — selalu validasi!
  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'URL wajib diisi'
    })
  }

  if (!isValidUrl(url)) {
    return res.status(400).json({
      success: false,
      error: 'Format URL tidak valid. Harus dimulai dengan http:// atau https://'
    })
  }

  // ── Generate kode unik ─────────────────────────────────────────────────
  // Loop untuk handle (sangat jarang) kasus kode yang sudah ada
  let code
  let attempts = 0
  do {
    code = generateCode()
    attempts++
    if (attempts > 10) {
      return res.status(500).json({ success: false, error: 'Gagal generate kode unik' })
    }
  } while (db.prepare('SELECT id FROM urls WHERE code = ?').get(code))

  // ── Hitung tanggal expired ─────────────────────────────────────────────
  const expiresAt = getExpiryDate(expiresInDays)

  // ── Simpan ke database ─────────────────────────────────────────────────
  // .prepare() = siapkan query SQL (lebih aman & cepat dari string biasa)
  // Tanda ? = placeholder, mencegah SQL Injection
  const insert = db.prepare(`
    INSERT INTO urls (code, original_url, expires_at)
    VALUES (?, ?, ?)
  `)

  const result = insert.run(code, url, expiresAt)

  // ── Kembalikan response ────────────────────────────────────────────────
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
  return res.status(201).json({
    success: true,
    data: {
      id:          result.lastInsertRowid,
      code:        code,
      short_url:   `${baseUrl}/${code}`,
      original_url: url,
      expires_at:  expiresAt,
      created_at:  new Date().toISOString()
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════
// ROUTE 2 — GET /:code
// Tugas: cari URL asli dari kode, redirect user ke sana
// Analogi: petugas loker yang ambilkan barang dari nomor yang disebutkan
// ════════════════════════════════════════════════════════════════════════════
router.get('/:code', (req, res) => {
  const { code } = req.params  // ambil "abc123" dari URL

  // ── Cari di database ───────────────────────────────────────────────────
  const link = db.prepare('SELECT * FROM urls WHERE code = ?').get(code)

  if (!link) {
    return res.status(404).json({
      success: false,
      error: `Short URL '${code}' tidak ditemukan`
    })
  }

  // ── Cek apakah sudah expired ───────────────────────────────────────────
  // Kalau expires_at ada DAN waktunya sudah lewat → tolak
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return res.status(410).json({
      success: false,
      error: 'Link ini sudah kadaluarsa',
      expired_at: link.expires_at
    })
    // 410 Gone = resource pernah ada tapi sudah tidak tersedia (lebih tepat dari 404)
  }

  // ── Tambah hitungan klik ───────────────────────────────────────────────
  // Atomic update: DB yang ngitung sendiri, bukan kita baca dulu lalu +1
  // Ini penting untuk menghindari race condition saat traffic tinggi
  db.prepare('UPDATE urls SET clicks = clicks + 1 WHERE code = ?').run(code)

  // ── Redirect! ──────────────────────────────────────────────────────────
  // 302 = redirect sementara (browser tidak cache) — standar untuk URL shortener
  return res.redirect(302, link.original_url)
})

// ════════════════════════════════════════════════════════════════════════════
// ROUTE 3 — GET /api/stats/:code
// Tugas: kembalikan data statistik sebuah link
// Analogi: laporan bulanan dari petugas loker — berapa kali loker dibuka
// ════════════════════════════════════════════════════════════════════════════
router.get('/api/stats/:code', (req, res) => {
  const { code } = req.params

  const link = db.prepare('SELECT * FROM urls WHERE code = ?').get(code)

  if (!link) {
    return res.status(404).json({
      success: false,
      error: 'Link tidak ditemukan'
    })
  }

  // ── Tentukan status link ───────────────────────────────────────────────
  let status = 'active'
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    status = 'expired'
  }

  const baseUrl = process.env.BASE_URL || 'http://localhost:3000'

  return res.json({
    success: true,
    data: {
      code:         link.code,
      short_url:    `${baseUrl}/${link.code}`,
      original_url: link.original_url,
      clicks:       link.clicks,
      status:       status,
      created_at:   link.created_at,
      expires_at:   link.expires_at
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════
// ROUTE 4 — GET /api/links
// Tugas: kembalikan semua link yang ada di database
// ════════════════════════════════════════════════════════════════════════════
router.get('/api/links', (req, res) => {
  const links = db.prepare(`
    SELECT * FROM urls ORDER BY created_at DESC
  `).all()  // .all() = ambil semua baris, bukan hanya satu

  const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
  const now = new Date()

  const data = links.map(link => ({
    code:         link.code,
    short_url:    `${baseUrl}/${link.code}`,
    original_url: link.original_url,
    clicks:       link.clicks,
    status:       link.expires_at && new Date(link.expires_at) < now
                    ? 'expired' : 'active',
    created_at:   link.created_at,
    expires_at:   link.expires_at
  }))

  return res.json({
    success: true,
    total: data.length,
    data
  })
})

// ════════════════════════════════════════════════════════════════════════════
// ROUTE 5 — DELETE /api/links/:code
// Tugas: hapus short URL dari database secara permanen
// ════════════════════════════════════════════════════════════════════════════
router.delete('/api/links/:code', (req, res) => {
  const { code } = req.params

  // Cek dulu ada tidak — supaya bisa beri pesan error yang tepat
  const link = db.prepare('SELECT id FROM urls WHERE code = ?').get(code)

  if (!link) {
    return res.status(404).json({
      success: false,
      error: 'Link tidak ditemukan'
    })
  }

  db.prepare('DELETE FROM urls WHERE code = ?').run(code)

  return res.json({
    success: true,
    message: `Link '${code}' berhasil dihapus`
  })
})

export default router