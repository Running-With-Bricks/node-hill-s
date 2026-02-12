import { EventEmitter } from "events"

import Game, { Disconnectable } from "./Game"

import Vector3 from "./Vector3"

import Player, { BodyColors, Assets } from "./Player"

import Outfit from "./Outfit"

import PacketBuilder, { PacketEnums } from "../net/PacketBuilder"

import createBotIds from "../net/BrickHillPackets/botIds"

import createAssetIds from "../net/BrickHillPackets/assetIds"

import setAvatar from "../scripts/player/setAvatar"

/**
 * Bots are fake players that player's can interact with. \
 * ![](https://cdn.discordapp.com/attachments/601268924251897856/655963821776830474/lhE5I4W_-_Imgur.gif)
 * 
 * You can do many things with them, and they even have very primitive AI capabilities.
 * 
 * An example of a zombie that can chase and kill players:
* ```js
* const zombie = new Bot("Zombie")
*
* const outfit = new Outfit()
*   .body("#0d9436")
*   .torso("#694813")
*   .rightLeg("#694813")
*   .leftLeg("#694813")
*
* zombie.setOutfit(outfit)
*
* Game.newBot(zombie)
*
* // We use bot.setinterval so that when the zombie is destroyed, the loop clears. 
* // It's good practice to do this to avoid memory leaks.
* zombie.setInterval(() => {
*   let target = zombie.findClosestPlayer(20)
*
*   if (!target) return zombie.setSpeech("")
*
*   zombie.setSpeech("BRAAINNNSSS!")
*
*   zombie.moveTowardsPlayer(target, 8)
* }, 10)
*
* let touchEvent = zombie.touching((p) => {
*   Game.messageAll(`[#ff0000]${p.username} was eaten by a zombie!`)
*   p.kill()
* })
* ```
**/
export default class Bot extends EventEmitter {
    name: string

    netId: number

    /** The speech bubble of the bot. ("" = empty). */
    speech = ""

    position: Vector3 = new Vector3(0, 0, 0)

    rotation: Vector3 = new Vector3(0, 0, 0)

    scale: Vector3 = new Vector3(1, 1, 1)

    /** If .destroy() has been called on the bot. */
    destroyed: boolean
    /** An object containing the body colors of the bot. */
    colors: BodyColors

    /** An object containing the current assets worn by the bot. */
    assets: Assets

    private _hitMonitor: NodeJS.Timeout

    private _steps: Array<NodeJS.Timeout>

    static botId = 0

    constructor(name: string) {
        super()

        Bot.botId += 1

        this._steps = []

        this.destroyed = false

        this.name = name

        this.netId = Bot.botId

        this.speech = ""

        // Positioning
        this.position = new Vector3(0, 0, 0)

        this.rotation = new Vector3(0, 0, 0)

        // Scale
        this.scale = new Vector3(1, 1, 1)

        this.colors = {
            head: "#d9bc00",
            torso: "#d9bc00",
            leftArm: "#d9bc00",
            rightArm: "#d9bc00",
            leftLeg: "#d9bc00",
            rightLeg: "#d9bc00",
        }

        this.assets = {
            tool: 0,
            face: 0,
            hat1: 0,
            hat2: 0,
            hat3: 0,
            clothing1: 0,
            clothing2: 0,
            clothing3: 0,
            clothing4: 0,
            clothing5: 0,
        }

        this.on("newListener", (event) => {
            if (event !== "touching") return
            this._detectTouching()
        })

        this.on("removeListener", (event) => {
            if (event !== "touching") return
            if (this.listenerCount("touching")) return
            clearInterval(this._hitMonitor)
        })
    }

    /** Remove the bot from Game.world, \
     * clear all event listeners, \
     * stop hit detection, \
     * and tell clients to delete the bot. */
    async destroy() {
        if (this.destroyed) return Promise.reject("Bot has already been destroyed.")

        const bots = Game.world.bots

        // Stop monitoring for hit detection
        clearInterval(this._hitMonitor)

        this._steps.forEach((loop) => {
            clearInterval(loop)
        })

        this.removeAllListeners()

        const index = bots.indexOf(this)

        if (index !== -1)
            bots.splice(index, 1)

        await new PacketBuilder(PacketEnums.DestroyBot)
            .write("uint32", this.netId)
            .broadcast()

        this.netId = undefined

        this.destroyed = true
    }

    /**
 * Identical to setInterval, but will be cleared after the bot is destroyed.
 * Use this if you want to attach loops to bots, but don't want to worry about clearing them after they're destroyed.
 * @param callback The callback function.
 * @param delay The delay in milliseconds.
 */
    setInterval(callback: () => void, delay: number): NodeJS.Timeout {
        const loop = setInterval(callback, delay)

        this._steps.push(loop)

        return loop
    }

    /** Set the position of the bot. */
    async setPosition(position: Vector3) {
        this.position = new Vector3().fromVector(position)
        return createBotIds(this, "BCDG")
    }

    /** Set the rotation of the bot. */
    async setRotation(rotation: Vector3) {
        this.rotation = new Vector3().fromVector(rotation)
        return createBotIds(this, "EFG")
    }

    /** Set the scale of the bot. */
    async setScale(scale: Vector3) {
        this.scale = new Vector3().fromVector(scale)
        return createBotIds(this, "HIJ")
    }

    /** Set the speech of the bot. */
    async setSpeech(speech: string) {
        this.speech = speech
        return createBotIds(this, "X")
    }

    async setOutfit(outfit: Outfit) {
        const promises = []

        // Patch assets + colors
        Object.assign(this.assets, outfit.assets)
        Object.assign(this.colors, outfit.colors)

        promises.push(createBotIds(this, "KLMNOP"))

        if (Object.keys(outfit.assets).length > 0)
            promises.push(createAssetIds(this, outfit.idString, "Bot").then(b => b.broadcast()))

        return Promise.all(promises)
    }

    /** Sets the bot's z rotation to the point provided. */
    async lookAtPoint(position: Vector3) {
        let angle = Math.atan2(position.y - this.position.y, position.x - this.position.x)

        angle = -(angle * (180 / Math.PI)) + 270

        this.rotation.z = angle

        await createBotIds(this, "G")

        return angle
    }

    /** Turns the bot to face the player provided. */
    async lookAtPlayer(player: Player) {
        return this.lookAtPoint(player.position)
    }

    /** Moves the bot to the point provided. */
    async moveTowardsPoint(pos: Vector3, speed = 5) {
        speed *= 0.01

        const angle = Math.atan2(pos.y - this.position.y, pos.x - this.position.x)
        const rot = -(angle * (180 / Math.PI)) + 270

        this.position.x += Math.cos(angle) * speed
        this.position.y += Math.sin(angle) * speed
        this.rotation.z = rot

        return createBotIds(this, "BCDG")
    }

    /** Moves the bot towards the player. */
    async moveTowardsPlayer(player: Player, speed: number) {
        return this.moveTowardsPoint(player.position, speed)
    }

    /** Returns the closest player to the bot, or null. */
    findClosestPlayer(minDist: number): Player {
        let target

        for (const player of Game.players) {
            if (player.destroyed || !player.alive) continue // Don't go after dead players
            const dist = Game.pointDistance3D(player.position, this.position)
            if (dist <= minDist) {
                minDist = dist
                target = player
            }
        }

        return target
    }

    /** Sets the bots avatar to a provided userId. */
    async setAvatar(userId: number) {
        await setAvatar(this, userId)
        return createBotIds(this, "KLMNOPQUVWRST")
    }

    /** Starts hit detection for the bot. */
    touching(callback: (player: Player) => void): Disconnectable {
        const touchEvent = (p: Player) => {
            callback(p)
        }
        this.on("touching", touchEvent)
        return {
            disconnect: () => this.off("command", touchEvent)
        }
    }

    private _detectTouching() {
        this._hitMonitor = setInterval(() => {
            if (!Game.players.length) return
            for (const player of Game.players) {
                if (!player.destroyed && player.alive) {
                    if (Game.pointDistance3D(player.position, this.position) <= 2)
                        this.emit("touching", player)
                }

            }
        }, 100)
    }
}

