// Generates the soft chime (src/renderer/src/assets/chime.wav): a bell-like tone
// made of a few decaying sine partials. Run: node scripts/make-chime.mjs
import { writeFileSync } from 'node:fs'

const rate = 44100
const seconds = 1.8
const partials = [
  { freq: 659.25, amp: 0.55, decay: 0.55 }, // E5
  { freq: 987.77, amp: 0.25, decay: 0.4 }, // B5
  { freq: 1318.5, amp: 0.12, decay: 0.25 } // E6
]
const n = Math.floor(rate * seconds)
const data = Buffer.alloc(n * 2)
for (let i = 0; i < n; i++) {
  const t = i / rate
  const attack = Math.min(1, t / 0.012)
  let v = 0
  for (const p of partials) v += p.amp * Math.exp(-t / p.decay) * Math.sin(2 * Math.PI * p.freq * t)
  const fadeOut = Math.min(1, (seconds - t) / 0.1)
  data.writeInt16LE(Math.round(v * attack * fadeOut * 0.5 * 32767), i * 2)
}
const header = Buffer.alloc(44)
header.write('RIFF', 0)
header.writeUInt32LE(36 + data.length, 4)
header.write('WAVE', 8)
header.write('fmt ', 12)
header.writeUInt32LE(16, 16)
header.writeUInt16LE(1, 20) // PCM
header.writeUInt16LE(1, 22) // mono
header.writeUInt32LE(rate, 24)
header.writeUInt32LE(rate * 2, 28)
header.writeUInt16LE(2, 32)
header.writeUInt16LE(16, 34)
header.write('data', 36)
header.writeUInt32LE(data.length, 40)
writeFileSync(new URL('../src/renderer/src/assets/chime.wav', import.meta.url), Buffer.concat([header, data]))
