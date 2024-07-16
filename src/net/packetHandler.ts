// Dependencies
import { SmartBuffer } from "smart-buffer"
import { ClientSocket } from "../class/Player"

import zlib from "zlib"

// Game objects
import Game from "../class/Game"
import Player from "../class/Player"

// Utility
import whiteListedKeys from "../util/keys/whitelisted"
import generateTitle from "../util/chat/generateTitle"
import { readUIntV } from "./uintv"

import scripts from "../scripts"

import checkAuth from "../api/checkAuth"
import Sanction from "../class/Sanction"
import formatHex from "../util/color/formatHex"

export enum ClientPacketType {
    Authentication = 1,
    Position = 2,
    Command = 3,
    Projectile = 4,
    ClickDetection = 5,
    PlayerInput = 6,
    KeyPress = 7,
    KeyRelease = 8,
    Heartbeat = 18
}

// Packets / uintv size cannot be over this limit.
const MAX_PACKET_SIZE = 1000

// Characters that are allowed in chat messages.
const ALLOWED_CHARACTERS = new RegExp(`[^ !"$-~]`, "g")

const clamp = (min: number, max: number) => (value: number) =>
    value < min ? min : value > max ? max : value

async function handlePacketType(type: ClientPacketType, socket: ClientSocket, reader: SmartBuffer) {
    const player = socket.player

    // Drop auth-required packets if the client isn't authenticated.
    if (type !== ClientPacketType.Authentication && !player) return

    switch (type) {
        case ClientPacketType.Authentication: {
            if (socket._attemptedAuthentication) {
                if (Sanction.banSocket(socket))
                    return console.warn("[SANCTION] Client attempted to authenticate more than once.")
                // If sanction is disabled we should destroy their socket.
                return socket.destroy()
            }

            socket._attemptedAuthentication = true

            const authResponse = await checkAuth(socket, reader)

            // User could not authenticate properly.
            if (typeof authResponse === "string") {
                console.log(`<Client: ${socket.IP}> Failed verification.`)
                return scripts.kick(socket, authResponse)
            }

            // Check if the users socket is still active after authentication.
            if (socket.destroyed) return

            // Check if player is already in game + kick them if so.
            for (const player of Game.players) {
                if (player.userId === authResponse.userId)
                    return scripts.kick(socket, "You can only join this game once per account.")
            }

            const authUser = new Player(socket)

            // Make properties readonly.
            Object.defineProperties(authUser, {
                userId: { value: authResponse.userId },
                username: { value: authResponse.username },
                admin: { value: authResponse.admin },
                membershipType: { value: authResponse.membershipType },
                client: { value: authResponse.client },
                validationToken: { value: authResponse.validator }
            })

            console.log(`Successfully verified! (Username: ${authUser.username} | ID: ${authUser.userId} | Admin: ${authUser.admin})`)

            if (Game.afterAuth !== null)
                await Game.afterAuth(authUser)

            if (socket._kickInProcess)
                return

            // Finalize the player joining process.
            Game._newPlayer(authUser)

            break
        }
        case ClientPacketType.Position: {
            const positionChanges = []

            try {
                for (let i = 0; i < 5; i++) {
                    let pos = reader.readFloatLE()

                    if (!Number.isFinite(pos)) throw "Unsafe"

                    switch (i) {
                        case 3: // Rotation x
                            pos = clamp(-360, 360)(pos)
                            break
                        case 4: // Camera Rotation
                            pos = clamp(-90, 90)(pos)
                            break
                        default: // X, Y, Z position
                            pos = clamp(-999999, 999999)(pos)
                    }

                    positionChanges.push(pos)
                }
            } catch (err) {
                return
            }

            player._updatePositionForOthers(positionChanges)

            break
        }
        case ClientPacketType.Command: {
            let command = "", args = ""

            try {
                command = reader.readStringNT()
                args = reader.readStringNT()
            } catch (err) {
                return
            }

            args = args.trim()

            /**
             * If this packet function didn't check the length of the chat message
             * then hosts using Game.on('chat') could cause clients to crash by relaying
             * very large chat messages.
             */
            if (args.length > 500) return

            // Convert # to <color:whatever>
            if (command === "chat") args = formatHex(args)

            // Remove problematic characters
            args = args.replace(ALLOWED_CHARACTERS, "")

            if (command === "chat") {
                // The host wants to manage chat on their own
                if (Game.listeners("chat").length)
                    return Game.emit("chat", player, args, generateTitle(player, args))

                return player.messageAll(args)
            }

            Game.emit("command", command, player, args)

            break
        }
        case ClientPacketType.Projectile: {
            break
        }
        case ClientPacketType.ClickDetection: {
            try {
                const brickId = reader.readUInt32LE()

                // Check for global bricks with that Id.
                const brick = Game.world.bricks.find(brick => brick.netId === brickId)
                if (brick && brick.clickable)
                    return brick.emit("clicked", player)

                // The brick might be local.
                const localBricks = player.localBricks
                const localBrick = localBricks.find(brick => brick.netId === brickId)

                if (localBrick && localBrick.clickable)
                    return localBrick.emit("clicked", player)
            } catch (err) {
                return
            }
            break
        }
        case ClientPacketType.PlayerInput: {
            try {
                const click = Boolean(reader.readUInt8())
                const key = reader.readStringNT()

                if (click) player.emit("mouseclick")

                if (key && whiteListedKeys.includes(key))
                    player.emit("keypress", key)
            } catch (err) {
                return
            }
            break
        }
        case ClientPacketType.KeyPress: {
            try {
                const amount = reader.readUInt8(reader.length - 1)
                for (let i = 0; i < amount; i++) {
                    const key = reader.readStringNT()
                    if (key && whiteListedKeys.includes(key))
                        player.emit("keydown", key)
                }
            } catch (err) {
                return
            }
            break
        }
        case ClientPacketType.KeyRelease: {
            try {
                const amount = reader.readUInt8(reader.length - 1)
                for (let i = 0; i < amount; i++) {
                    const key = reader.readStringNT()
                    if (key && whiteListedKeys.includes(key))
                        player.emit("keyup", key)
                }
            } catch (err) {
                return
            }
            break
        }
        case ClientPacketType.Heartbeat: {
            player.socket.keepalive.restartTimer()
        }
    }
}

export default async function parsePacket(socket: ClientSocket, rawBuffer: Buffer) {
    let packets = []

    if (rawBuffer.length <= 1)
        return socket._chunk.clear();

    (function readMessages(socket) {
        // Packet is new, parse the size of it.
        if (!socket._chunk.remaining) {
            const { messageSize, end } = readUIntV(socket._chunk.recieve)

            if (messageSize > MAX_PACKET_SIZE && Sanction.banSocket(socket)) {
                packets = []
                Sanction.debugLog({ banType: "UINTV_SIZE", uintvSize: messageSize, buffer: socket._chunk.recieve.toString('hex') })
                socket._chunk.clear()
                return console.warn(`[SANCTION] Client sent a packet with a uintv size larger than ${MAX_PACKET_SIZE} bytes.`)
            }

            socket._chunk.remaining = messageSize
            socket._chunk.recieve = socket._chunk.recieve.slice(end)
        }

        // Packet is complete
        if (socket._chunk.recieve.length === socket._chunk.remaining) {
            packets.push(socket._chunk.recieve)
            socket._chunk.clear()
            return
        }

        // Remaining packets
        if (socket._chunk.recieve.length > socket._chunk.remaining) {
            packets.push(socket._chunk.recieve.slice(0, socket._chunk.remaining))
            socket._chunk.recieve = socket._chunk.recieve.slice(socket._chunk.remaining)
            socket._chunk.remaining = 0
            readMessages(socket)
        }
    })(socket)

    for (let packet of packets) {
        try {
            packet = zlib.inflateSync(packet)
        } catch (err) { }

        if (packet.length > MAX_PACKET_SIZE && Sanction.banSocket(socket)) {
            packets = []
            Sanction.debugLog({ banType: "PACKET_TOO_LARGE", buffer: packet.toString('hex') })
            return console.warn(`[SANCTION] Client sent a packet larger than ${MAX_PACKET_SIZE} bytes.`)
        }

        const reader = SmartBuffer.fromBuffer(packet)

        // Check for the packet type
        let type: number
        try {
            type = reader.readUInt8()
        } catch (err) { }

        // Packet ID was not valid
        if (Game.banNonClientTraffic && !Object.values(ClientPacketType).includes(type)) {
            if (Sanction.banSocket(socket)) {
                Sanction.debugLog({ banType: "NON_BH_TRAFFIC", packetType: type, buffer: packet.toString('hex') })
                return console.warn("[SANCTION] Client sent non-Brick Hill traffic.")
            }
        }

        if (Game.listenerCount("newPacket")) {
            Game.emit("newPacket", {
                packetId: type,
                player: socket.player,
                buffer: packet
            })
        }

        handlePacketType(type, socket, reader)
    }
}