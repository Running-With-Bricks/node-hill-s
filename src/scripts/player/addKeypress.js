const PacketBuilder = require("../../net/PacketBuilder").default

async function addKeypress(socket, key) {
    await new PacketBuilder("AddKeypress")
        .write("string", key)
        .write("bool", true)
        .send(socket)
}
module.exports = addKeypress