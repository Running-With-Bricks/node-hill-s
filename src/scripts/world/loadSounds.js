const addSoundProperties = require("./sendSound")
const AssetDownloader = require("../../class/AssetDownloader").default
const PacketBuilder = require("../../net/PacketBuilder").default

async function loadSounds(sounds = []) {
    if (!sounds.length) return

    const packet = new PacketBuilder("SendSoundEmitters", { compression: true })
        .write("uint32", sounds.length)

    const assetRequests = []

    for (const sound of sounds)
        assetRequests.push(AssetDownloader.getAssetData(sound.sound).catch(() => { }))

    await Promise.all(assetRequests)

    for (const sound of sounds)
        await addSoundProperties(packet, sound)

    return packet
}

module.exports = loadSounds