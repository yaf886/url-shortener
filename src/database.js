// src/database.js
import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// ─── Cari lokasi folder proyek ───────────────────────────────────────────────
// Karena pakai ES Module, __dirname tidak tersedia langsung.
// Ini cara modernnya — seperti nanya "saya sekarang ada di folder mana?"
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ─── Buka / buat file database ───────────────────────────────────────────────
// Kalau file database.db belum ada, SQLite otomatis membuatnya.
// Bayangkan ini seperti "buka buku catatan, kalau belum ada — beli dulu"
const db = new Database(join(__dirname, '..', 'database.db'))

// ─── Optimasi performa SQLite ────────────────────────────────────────────────
// WAL mode = bisa baca & tulis bersamaan. Wajib untuk aplikasi web.
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ─── Buat tabel kalau belum ada ──────────────────────────────────────────────
// "IF NOT EXISTS" = cek dulu sebelum buat. Aman dijalankan berkali-kali.
db.exec(`
  CREATE TABLE IF NOT EXISTS urls (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT    NOT NULL UNIQUE,
    original_url TEXT   NOT NULL,
    clicks      INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    expires_at  TEXT    NULL
  )
`)

// ─── Buat index untuk mempercepat pencarian by code ──────────────────────────
// Index itu seperti "daftar isi buku" — tanpa index, database harus baca
// semua baris satu per satu. Dengan index, langsung lompat ke baris yang tepat.
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_urls_code ON urls(code)
`)

console.log('✅ Database siap!')

export default db