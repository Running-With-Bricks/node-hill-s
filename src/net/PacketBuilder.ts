import { deflateSync } from "zlib"

import { SmartBuffer } from "smart-buffer"

import * as uintv from "./uintv"

import Game from "../class/Game"

import Player, { ClientSocket } from "../class/Player"

import AssetDownloader from "../class/AssetDownloader"
import Vector3 from "../class/Vector3"

export interface PacketBuilderOptions {
    compression?: boolean
}

export enum PacketEnums {
    Authentication = 1,

    SendBrick = 17,

    SendPlayers = 3,

    Figure = 4,

    RemovePlayer = 5,

    Chat = 6,

    PlayerModification = 7,

    Kill = 8,

    Brick = 9,

    Team = 10,

    Tool = 11,

    Bot = 12,

    ClearMap = 14,

    DestroyBot = 15,

    DeleteBrick = 16,

    AddKeypress = 21,

    SoundEmitter = 22,

    SendSoundEmitters = 23,

}

export default class PacketBuilder {
    packetId: number
    idString: string
    compression: boolean
    buffer: SmartBuffer
    options: PacketBuilderOptions

    constructor(packetType: keyof typeof PacketEnums | PacketEnums, options?: PacketBuilderOptions) {
        if (typeof packetType === "string")
            this.packetId = PacketEnums[packetType]
        else
            this.packetId = packetType

        this.buffer = new SmartBuffer()

        this.idString = ""

        this.options = options || {
            compression: false
        }
    }
    write(type: "string", data: string): PacketBuilder;
    write(type: "bool", data: boolean): PacketBuilder;
    write(type: "float" | "uint8" | "int32" | "uint32", data: number): PacketBuilder;
    write(type: "vector3", data: Vector3): PacketBuilder;

    write(type: string, data: any): PacketBuilder {
        switch (type) {
            case "string": {
                this.buffer.writeStringNT(data as string)
                break
            }
            case "bool": {
                data = data ? 1 : 0
                this.buffer.writeUInt8(data)
                break
            }
            case "float": {
                this.buffer.writeFloatLE(data as number)
                break
            }
            case "uint8": {
                this.buffer.writeUInt8(data as number)
                break
            }
            case "int32": {
                this.buffer.writeInt32LE(data as number)
                break
            }
            case "uint32": {
                this.buffer.writeUInt32LE(data as number)
                break
            }
            case "vector3": {
                this.buffer.writeFloatLE(data.x as number)
                this.buffer.writeFloatLE(data.y as number)
                this.buffer.writeFloatLE(data.z as number)
            }
        }
        return this
    }

    writeHeader(): void {
        this.buffer.insertUInt8(this.packetId, 0)

        if (this.idString)
            this.buffer.insertStringNT(this.idString, 1)
    }

    async writeAsset(assetId: number): Promise<PacketBuilder> {
        if (!assetId)
            return this.write("string", "none")

        const data = await AssetDownloader.getAssetData(assetId).catch(() => { })

        if (!data) return this

        if (data.mesh)
            this.write("string", data.mesh)
        if (data.texture)
            this.write("string", data.texture)
        if (data.sound)
            this.write("string", data.sound)

        return this
    }

    // Convert SmartBuffer to a buffer, compress it, and add uintv size to header.
    private transformPacket() {
        this.writeHeader()

        let packet = this.buffer.toBuffer()

        if (this.options.compression)
            packet = deflateSync(packet)

        return uintv.writeUIntV(packet)
    }

    /** 
     * Send a packet to every connected client except for players specified.
    */
    async broadcastExcept(players: Array<Player>): Promise<boolean> {
        const packet = this.transformPacket()

        const promises = []

        for (const player of Game.players) {
            if (!players.includes(player) && !player.socket.destroyed) {
                promises.push(new Promise((resolve) => {
                    player.socket.write(packet, null, resolve)
                }))
            }
        }

        await Promise.all(promises)

        return true
    }

    /**
     * Send a packet to every connected client.
     */
    async broadcast(): Promise<boolean> {
        const packet = this.transformPacket()

        const promises = []

        for (const player of Game.players) {
            if (!player.socket.destroyed) {
                promises.push(new Promise((resolve) => {
                    player.socket.write(packet, null, resolve)
                }))
            }
        }

        await Promise.all(promises)

        return true
    }

    /**
     * Send a packet to a single client.
    */
    async send(socket: ClientSocket): Promise<boolean> {
        const packet = this.transformPacket()

        if (socket.destroyed) return

        return socket.write(packet, null, () => {
            return Promise.resolve(true)
        })
    }
}