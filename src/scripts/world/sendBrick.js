const { hexToDec } = require("../../util/color/colorModule").default

async function addBrickProperties(packet, brick) {
    packet.write("uint32", brick.netId)
    packet.write("float", brick.position.x)
    packet.write("float", brick.position.y)
    packet.write("float", brick.position.z)
    packet.write("float", brick.scale.x)
    packet.write("float", brick.scale.y)
    packet.write("float", brick.scale.z)
    packet.write("uint32", hexToDec(brick.color))
    packet.write("float", brick.visibility)

    // Additional attributes
    let attributes = ""
    if (brick.rotation)
        attributes += "I"

    if (brick.shape)
        attributes += "B"

    if (brick.lightEnabled)
        attributes += "D"

    if (!brick.collision)
        attributes += "F"

    if (brick.clickable)
        attributes += "G"

    if (brick.model)
        attributes += "C"

    packet.write("string", attributes)

    for (let i = 0; i < attributes.length; i++) {
        const ID = attributes.charAt(i)
        switch (ID) {
            case "B":
                packet.write("string", brick.shape)
                break
            case "D":
                packet.write("uint32", hexToDec(brick.lightColor))
                packet.write("uint32", brick.lightRange)
                break
            case "G":
                packet.write("bool", brick.clickable)
                packet.write("uint32", brick.clickDistance)
                break
            case "I":
                packet.write("int32", brick.rotation.x)
                packet.write("int32", brick.rotation.y)
                packet.write("int32", brick.rotation.z)
                break
        }

    }

    // Write the asset data last.
    if (attributes.indexOf("C") !== -1)
        await packet.writeAsset(brick.model)

    return packet
}

module.exports = addBrickProperties