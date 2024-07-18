const PacketBuilder = require("../../net/PacketBuilder").default

const { hexToDec } = require("../../util/color/colorModule").default

const formatHex = require("../../util/color/formatHex").default

function createPlayerIdBuffer(player, idString = "") {
    // No player team, remove "Y" if it exists.
    if (!player.team)
        idString = idString.replace(/Y/g, "")

    const length = idString.length

    const playerPacket = new PacketBuilder("Figure")
        .write("uint32", player.netId)

    playerPacket.idString += idString

    for (let i = 0; i < length; i++) {
        const ID = idString.charAt(i)
        switch (ID) {
            case "A": {
                playerPacket.write("float", player.position.x)
                break
            }
            case "B": {
                playerPacket.write("float", player.position.y)
                break
            }
            case "C": {
                playerPacket.write("float", player.position.z)
                break
            }
            case "D": {
                playerPacket.write("float", player.rotation.x)
                break
            }
            case "E": {
                playerPacket.write("float", player.rotation.y)
                break
            }
            case "F": {
                playerPacket.write("float", player.rotation.z)
                break
            }
            case "G": {
                playerPacket.write("float", player.scale.x)
                break
            }
            case "H": {
                playerPacket.write("float", player.scale.y)
                break
            }
            case "I": {
                playerPacket.write("float", player.scale.z)
                break
            }
            case "J": {
                playerPacket.write("uint32", player.tool._slotId)
                break
            }
            case "K": {
                playerPacket.write("uint32", hexToDec(player.colors.head))
                break
            }
            case "L": {
                playerPacket.write("uint32", hexToDec(player.colors.torso))
                break
            }
            case "M": {
                playerPacket.write("uint32", hexToDec(player.colors.leftArm))
                break
            }
            case "N": {
                playerPacket.write("uint32", hexToDec(player.colors.rightArm))
                break
            }
            case "O": {
                playerPacket.write("uint32", hexToDec(player.colors.leftLeg))
                break
            }
            case "P": {
                playerPacket.write("uint32", hexToDec(player.colors.rightLeg))
                break
            }
            case "X": {
                playerPacket.write("int32", player.score)
                break
            }
            case "Y": {
                playerPacket.write("uint32", player.team.netId)
                break
            }
            case "1": {
                playerPacket.write("uint32", player.speed)
                break
            }
            case "2": {
                playerPacket.write("uint32", player.jumpPower)
                break
            }
            case "3": {
                playerPacket.write("uint32", player.cameraFOV)
                break
            }
            case "4": {
                playerPacket.write("int32", player.cameraDistance)
                break
            }
            case "5": {
                playerPacket.write("float", player.cameraPosition.x)
                break
            }
            case "6": {
                playerPacket.write("float", player.cameraPosition.y)
                break
            }
            case "7": {
                playerPacket.write("float", player.cameraPosition.z)
                break
            }
            case "8": {
                playerPacket.write("float", player.cameraRotation.x)
                break
            }
            case "9": {
                playerPacket.write("float", player.cameraRotation.y)
                break
            }
            case "a": {
                playerPacket.write("float", player.cameraRotation.z)
                break
            }
            case "b": {
                playerPacket.write("string", player.cameraType)
                break
            }
            case "c": {
                playerPacket.write("uint32", player.cameraObject.netId)
                break
            }
            case "e": {
                playerPacket.write("float", player.health)
                break
            }
            case "f": {
                playerPacket.write("string", formatHex(player.speech))
                break
            }
            case "h": { // Set items + arm to -1
                break
            }
            case "o": {
                playerPacket.write("float", player.gravity)
                break
            }
        }
    }

    return playerPacket
}

module.exports = createPlayerIdBuffer