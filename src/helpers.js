// src/helpers.js
import { customAlphabet } from 'nanoid'

// ─── Konfigurasi generator kode ──────────────────────────────────────────────
// Kita buat alfabet sendiri — hanya huruf & angka yang mudah dibaca.
// Tidak pakai: 0, O, I, l (sering tertukar saat dibaca manusia)
const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ'
const LENGTH = 6  // panjang kode: "abc123" = 6 karakter

// customAlphabet menghasilkan fungsi generator dengan aturan di atas
const generateId = customAlphabet(ALPHABET, LENGTH)

// ─── Generate short code ─────────────────────────────────────────────────────
export function generateCode() {
  return generateId()  // contoh output: "mK7p2x"
}

// ─── Validasi URL ─────────────────────────────────────────────────────────────
// Cek apakah string yang dikirim user benar-benar URL valid.
// Pakai class URL bawaan Node.js — tidak perlu regex rumit!
export function isValidUrl(string) {
  try {
    const url = new URL(string)
    // Hanya izinkan http dan https (bukan ftp://, javascript://, dll)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false  // kalau new URL() throw error, berarti URL tidak valid
  }
}

// ─── Hitung tanggal expired ───────────────────────────────────────────────────
// Input: jumlah hari (misal: 7)
// Output: string datetime ISO (misal: "2024-02-15T10:00:00.000Z")
export function getExpiryDate(days) {
  if (!days || days <= 0) return null  // null = tidak ada expired
  const date = new Date()
  date.setDate(date.getDate() + days)  // tambah N hari dari sekarang
  return date.toISOString()
}