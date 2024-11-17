async function addSoundProperties(packet, sound) {
    packet.write("uint32", sound.netId)
    await packet.writeAsset(sound.sound)
    packet.write("vector3", sound.position)

    // Additional attributes
    let attributes = ""
    if (sound.volume != 1)
        attributes += "A"

    if (sound.pitch != 1)
        attributes += "B"

    if (sound.loop)
        attributes += "C"

    if (sound.range != 10)
        attributes += "D"

    if (sound.global)
        attributes += "F"

    packet.write("string", attributes)

    for (let i = 0; i < attributes.length; i++) {
        const ID = attributes.charAt(i)
        switch (ID) {
            case "A":
                packet.write("float", sound.volume)
                break
            case "B":
                packet.write("float", sound.pitch)
                break
            case "C":
                packet.write("bool", sound.loop)
                break
            case "D":
                packet.write("float", sound.range)
                break
            case "F":
                packet.write("bool", sound.global)
                break
        }

    }

    return packet
}

module.exports = addSoundProperties