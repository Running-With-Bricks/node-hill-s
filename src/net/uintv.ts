interface Message {
    messageSize: number
    end: number
}

export function readUIntV(buffer: Buffer): Message {
    // 1 Byte
    if (buffer[0] & 1) {
        const messageSize = buffer[0] >> 1

        if (!messageSize)
            throw new RangeError("Zero-length uintv frames are invalid.")

        return {
            messageSize,
            end: 1
        }
        // 2 Bytes
    } else if (buffer[0] & 2) {
        return {
            messageSize: (buffer.readUInt16LE(0) >> 2) + 0x80,
            end: 2
        }
        // 3 Bytes
    } else if (buffer[0] & 4) {
        return {
            messageSize:
                (buffer[2] << 13) +
                (buffer[1] << 5) +
                (buffer[0] >> 3) +
                0x4080,
            end: 3
        }
        // 4 Bytes
    } else {
        return {
            messageSize: buffer.readUInt32LE(0) / 8 + 0x204080,
            end: 4
        }
    }
}

export function writeUIntV(buffer: Buffer) {
    const length = buffer.length

    // 1 Byte
    if (length < 0x80) {
        const size = Buffer.alloc(1)
        size.writeUInt8((length << 1) + 1, 0)

        return Buffer.concat([size, buffer])
        // 2 Bytes
    } else if (length < 0x4080) {
        const size = Buffer.alloc(2)
        size.writeUInt16LE(((length - 0x80) << 2) + 2, 0)

        return Buffer.concat([size, buffer])
        // 3 Bytes
    } else if (length < 0x204080) {
        const size = Buffer.alloc(3)
        const writeValue = ((length - 0x4080) << 3) + 4
        size.writeUInt8(writeValue & 0xff, 0)
        size.writeUInt16LE(writeValue >> 8, 1)

        return Buffer.concat([size, buffer])
        // 4 Bytes
    } else {
        const size = Buffer.alloc(4)
        size.writeUInt32LE((length - 0x204080) * 8, 0)

        return Buffer.concat([size, buffer])
    }
}
