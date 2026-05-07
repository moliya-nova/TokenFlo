// Generates a simple 32x32 blue icon for the system tray
const { writeFileSync } = require('fs')
const { join } = require('path')

// Create a minimal 16x16 PNG with a blue circle
// Using raw pixel data with zlib compression
const zlib = require('zlib')

const width = 16
const height = 16

// Build raw pixel data (RGBA rows, with filter byte 0 per row)
const rawData = Buffer.alloc(height * (1 + width * 4))
for (let y = 0; y < height; y++) {
  const rowOffset = y * (1 + width * 4)
  rawData[rowOffset] = 0 // filter: none
  for (let x = 0; x < width; x++) {
    const px = rowOffset + 1 + x * 4
    const cx = 7.5, cy = 7.5, r = 6.5
    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
    if (dist <= r) {
      rawData[px] = 74     // R
      rawData[px + 1] = 144 // G
      rawData[px + 2] = 217 // B
      rawData[px + 3] = 255 // A
    } else {
      rawData[px + 3] = 0   // transparent
    }
  }
}

const compressed = zlib.deflateSync(rawData)

// PNG signature
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

// IHDR chunk
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(width, 0)
ihdr.writeUInt32BE(height, 4)
ihdr[8] = 8  // bit depth
ihdr[9] = 6  // color type: RGBA
ihdr[10] = 0 // compression
ihdr[11] = 0 // filter
ihdr[12] = 0 // interlace

function makeChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const crcData = Buffer.concat([typeBuffer, data])
  const crc = crc32(crcData)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc, 0)
  return Buffer.concat([length, typeBuffer, data, crcBuf])
}

// CRC32 implementation for PNG
function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xedb88320
      } else {
        crc = crc >>> 1
      }
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

const ihdrChunk = makeChunk('IHDR', ihdr)
const idatChunk = makeChunk('IDAT', compressed)
const iendChunk = makeChunk('IEND', Buffer.alloc(0))

const png = Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk])
writeFileSync(join(__dirname, '..', 'resources', 'icon.png'), png)
console.log('Icon generated: resources/icon.png')
