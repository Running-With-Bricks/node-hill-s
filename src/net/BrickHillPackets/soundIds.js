const PacketBuilder = require("../../net/PacketBuilder").default

async function createSoundIdBuffer(sound, modification) {
    const soundPacket = new PacketBuilder("SoundEmitter")
        .write("uint32", sound.netId)
        .write("string", modification)

    switch (modification) {
        case "position": {
            soundPacket.write("vector3", sound.position)
            break
        }
        case "volume": {
            soundPacket.write("float", sound.volume)
            break
        }
        case "pitch": {
            soundPacket.write("float", sound.pitch)
            break
        }
        case "loop": {
            soundPacket.write("bool", sound.loop)
            break
        }
        case "range": {
            soundPacket.write("float", sound.range)
            break
        }
        case "global": {
            soundPacket.write("bool", sound.global)
            break
        }
        case "sound": {
            await soundPacket.writeAsset(sound.sound)
            break
        }
        case "destroy":
        case "stop":
        case "play": {
            break
        }
        
    }

    return soundPacket.broadcast()
}

module.exports = createSoundIdBuffer