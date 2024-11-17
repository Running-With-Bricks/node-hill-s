import { EventEmitter } from "events"

import Game, { Disconnectable } from "./Game"

import Vector3 from "./Vector3"

import PacketBuilder, { PacketEnums } from "../net/PacketBuilder"

import createSoundPacket from "../net/BrickHillPackets/soundIds"

export default class SoundEmitter extends EventEmitter {
    name: string

    netId: number

    /** Item id of the sound to use */
    sound: number

    /** Volume of the sound emitted */
    volume = 1

    /** Pitch of the sound emitted */
    pitch = 1

    /** Range of the sound emitted */
    range = 10

    /** Whether or not to loop the sound */
    loop = false

    /** Whether or not to play the sound globally */
    global = false

    position: Vector3 = new Vector3(0, 0, 0)

    /** If .destroy() has been called on the sound emitter. */
    destroyed = false

    private _steps: Array<NodeJS.Timeout>

    static soundEmitterId = 0

    constructor(sound: number, position = new Vector3(0, 0, 0), range = 10) {
        super()

        SoundEmitter.soundEmitterId += 1

        this.netId = SoundEmitter.soundEmitterId

        this._steps = []

        this.sound = sound

        this.volume = 1

        this.pitch = 1

        this.range = range

        this.loop = false

        // Positioning
        this.position = position

        this.destroyed = false

    }

    /** Remove the sound emitter from Game.world, \
     * clear all event listeners, \
     * and tell clients to delete the sound emitter. */
    async destroy() {
        if (this.destroyed) return Promise.reject("Sound emitter has already been destroyed.")

        const sounds = Game.world.sounds


        this._steps.forEach((loop) => {
            clearInterval(loop)
        })

        this.removeAllListeners()

        const index = sounds.indexOf(this)

        if (index !== -1)
            sounds.splice(index, 1)

        
        await createSoundPacket(this, "destroy")

        this.netId = undefined

        this.destroyed = true
    }

    /**
 * Identical to setInterval, but will be cleared after the sound emitter is destroyed.
 * Use this if you want to attach loops to sound emitters, but don't want to worry about clearing them after they're destroyed.
 * @param callback The callback function.
 * @param delay The delay in milliseconds.
 */
    setInterval(callback: () => void, delay: number): NodeJS.Timeout {
        const loop = setInterval(callback, delay)

        this._steps.push(loop)

        return loop
    }

    /** Set the position of the sound emitter. */
    async setPosition(position: Vector3) {
        this.position = new Vector3().fromVector(position)
        return await createSoundPacket(this, "position")
    }

    /** Set the volume of the sound emitter. */
    async setVolume(volume: number) {
        this.volume = volume
        return await createSoundPacket(this, "volume")
    }

    /** Set the pitch of the sound emitter. */
    async setPitch(pitch: number) {
        this.pitch = pitch
        return await createSoundPacket(this, "pitch")
    }

    /** Set the looping of the sound emitter. */
    async setLoop(loop: boolean) {
        this.loop = loop
        return await createSoundPacket(this, "loop")
    }

    /** Set the range of the sound emitter. */
    async setRange(range: number) {
        this.range = range
        return await createSoundPacket(this, "range")
    }

    async setGlobal(global: boolean) {
        this.global = global
        return await createSoundPacket(this, "global")
    }

    /** Set the sound to emit. */
    async setSound(sound: number) {
        this.sound = sound
        return await createSoundPacket(this, "sound")
    }

    /** Play the sound */
    async play() {
        return await createSoundPacket(this, "play")
    }

    /** Stop the sound */
    async stop() {
        return await createSoundPacket(this, "stop")
    }
}

