import { resolve, basename, join } from "path"

import { EventEmitter } from "events"

import { Server } from "net"

import { version } from "../../package.json"

export interface SetData {
    id: number,
    creator: {
        id: number,
        username: string,
        avatar_hash: string
    },
    name: string,
    description: string,
    playing: number,
    visits: number,
    created_at: string,
    updated_at: string,
    thumbnail: string | null,
    genre: {
        id: number,
        type: string
    }
}

export interface World {
    /** An array containing all the teams in the game. */
    teams: Array<Team>,
    /** An object containing various environment properties. */
    environment: Environment,
    /** An array containg all the bricks in the game. */
    bricks: Array<Brick>,
    /** An array containing bricks, when a player respawns it will choose a random position from a brick in this array. */
    spawns: Array<Brick>,
    /** An array containing all the bots in the game. */
    bots: Array<Bot>,
    /** An array of all the tools in the game. */
    tools: Array<Tool>,
}

export interface Disconnectable {
    /** Stops the event listener. */
    disconnect: () => void
}

/** Weather types. */
export enum Weather {
    Sun = "sun",
    Rain = "rain",
    Snow = "snow",
}

/** Environment properties. */
export interface Environment {
    ambient: string,
    skyColor: string,
    baseColor: string,
    baseSize: number,
    sunIntensity: number,
    weather: Weather,
}

/** All data loaded / exported from a brk. */
export interface MapData {
    bricks: Array<Brick>,
    spawns: Array<Brick>,
    environment: Environment,
    tools: Array<Tool>,
    teams: Array<Team>,
}

export interface PacketData {
    packetId: number,
    player: Player,
    buffer: Buffer
}

export enum GameEvents {
    InitialSpawn = "initialSpawn",
    PlayerJoin = "playerJoin",
    PlayerLeave = "playerLeave",
    Chatted = "chatted",
    Chat = "chat",
    ScriptsLoaded = "scriptsLoaded",
    SetDataLoaded = "setDataLoaded",
    NewPacket = "newPacket"
}

export class Game extends EventEmitter {
    /** 
   * Identical to player.on("initialSpawn").
   * @event
   * @example
   * ```js
   * Game.on("initialSpawn", (player) => {
   *    // "player" is now fully loaded.
    * })
    * ```
   */

    static readonly initialSpawn = GameEvents.InitialSpawn

    /** 
   * Fires immediately whenever a player joins the game. (Before player downloads bricks, players, assets, etc).
   * @event
   * @param player [Player]{@link Player}
   * @example
   * ```js
   * Game.on("playerJoin", (player) => {
   *    console.log("Hello: " + player.username)
   * })
   * ```
   */
    static readonly playerJoin = GameEvents.PlayerJoin

    /** 
   * Fires whenever a player leaves the game.
   * @event
   * @param player [Player]{@link Player}
   * @example
   * ```js
   * Game.on("playerLeave", (player) => {
   *    console.log("Goodbye: " + player.username)
   * })
   * ```
   */
    static readonly playerLeave = GameEvents.PlayerLeave

    /** 
   * Fires whenever any player chats in the game.
   * @event
   * @param player [Player]{@link Player}
   * @param message Message
   * @example
   * ```js
   * Game.on("chatted", (player, message) => {
   *    console.log(message)
   * })
   * ```
   */
    static readonly chatted = GameEvents.Chatted

    /** 
   * If a `Game.on("chat")` listener is added, any time the game recieves a chat message, it will be emitted data to this listener, and
   * the actual packet for sending the chat will not be sent.
   * 
   * You can use this to intercept chat messages, and then transform them to whatever, and then call `Game.messageAll`.
   * @event
   * @param player [Player]{@link Player}
   * @param message Message
   * @example
   * ```js
   * Game.on("chat", (player, message) => {
   *    Game.messageAll(player.username + " screams loudly: " + message)
   * })
   * ```
   */
    static readonly chat = GameEvents.Chat


    /**
     * Fires whenever the scripts finish loading.
     * @event
     * @example
     * ```js
     * Game.on("scriptsLoaded", () => {
     *  // Do something
     * })
     */
    static readonly scriptsLoaded = GameEvents.ScriptsLoaded

    /**
     * Fires when Game.setData is populated after the initial server post.
     * You should use Game.setDataLoaded() instead of using a listener.
     * @event
     * @example
     * ```js
     * Game.setDataLoaded().then(() => {
     *  console.log(Game.setData)
     * })
     */
    static readonly setDataLoaded = GameEvents.SetDataLoaded

    /** @readonly An array of all currently in-game (and authenticated) players. */
    players: Array<Player>

    /** @readonly The package.json "version" of the node-hill library. **/
    version: string

    /**
     * This property is to compensate for a client bug. If the player team is
     * not set automatically, the user's name won't appear on their client's leaderboard.
     * 
     * Only disable this if you are going to set the player's team when they join.
     */
    assignRandomTeam = true

    /** If set to false, players will not spawn in the game. */
    playerSpawning = true

    /** If set to false, the bricks of the map will not be sent to the player when they join. But they will still be loaded into memory. */
    sendBricks = true

    /** A direct pointer to the server start settings (usually start.js) */
    serverSettings: GameSettings

    /** If set to false server join messages, etc will not be sent to players. */
    systemMessages = true

    /**
     * The message that will be sent to players (locally) who join the game.
     * 
     * @default [#14d8ff][NOTICE]: This server is proudly hosted with node-hill-s {@link version}.
     */
    MOTD: string

    /**
     * An object containing players, teams, environment settings, etc.
     * @global
     */
    world: World

    /** @readonly The main server TCP socket. */
    server: Server

    banNonClientTraffic: boolean

    chatSettings: Record<'rateLimit', number>

    setData: Record<string, never> | SetData

    afterAuth: (player: Player) => Promise<void>

    constructor() {
        super()

        this.players = []

        this.setData = {}

        this.chatSettings = {
            rateLimit: 2000
        }

        this.version = version

        this.banNonClientTraffic = true

        this.assignRandomTeam = true

        this.sendBricks = true

        this.playerSpawning = true

        this.systemMessages = true

        this.MOTD = `[#14d8ff][NOTICE]: This server is proudly hosted with node-hill-s ${this.version}.`

        this.afterAuth = null

        this.world = {
            environment: {
                ambient: "#000000",
                skyColor: "#71b1e6",
                baseColor: "#248233",
                baseSize: 100,
                sunIntensity: 400,
                weather: Weather.Sun
            },

            teams: [],

            bricks: [],

            tools: [],

            spawns: [],

            bots: []
        }
    }

    /**  
     * Returns player stats in JSON from this API: \
     * https://sandpile.xyz/api/getUserInfoById/{userId}
     * 
    */
    async getUserInfo(userId: number): Promise<JSON> {
        return scripts.getUserInfo(userId)
    }

    /** Sends a chat message to every player in the game. */
    async messageAll(message: string) {
        return scripts.message.messageAll(message)
    }

    async topPrintAll(message: string, seconds: number) {
        return scripts.topPrintAll(message, seconds)
    }

    async centerPrintAll(message: string, seconds: number) {
        return scripts.centerPrintAll(message, seconds)
    }

    async bottomPrintAll(message: string, seconds: number) {
        return scripts.bottomPrintAll(message, seconds)
    }

    /** 
    * Commands are sent from the client when a user prefixes their message with `/` followed by any string. \
    * In the example below, "kick" would be the command, and "user" the argument: \
    * **Example**: `/kick user`
    * @callback
    * @example
    * ```js
    * Game.command("kick", (caller, args) => {
    *   if (caller.userId !== 2760) return // You're not dragonian!
    *   for (let player of Game.players) {
    *       if (player.username.startsWith(args)) {
    *           return player.kick("Kicked by Dragonian!")
    *       }
    *   }
    * })
    * ```
    */
    command(gameCommand: string, validator: (p: Player, args: string, next: () => void) => void, callback?: () => void): Disconnectable {
        const cmd = (cmd: string, p: Player, args: string) => {
            if (cmd === gameCommand) {
                validator(p, args, callback)
            }
        }
        this.on("command", cmd)
        return {
            disconnect: () => this.off("command", cmd)
        }
    }

    /**
     * Identical to Game.command, but instead of a string it takes an array of commands.
     * 
     * This will assign them all to the same callback, this is very useful for creating alias commands.
     * @see {@link command}
     * @example
     * ```js
     * Game.commands(["msg", "message"], (p, args) => {
     *      Game.messageAll(args)
     * })
     * ```
     */
    commands(gameCommand: string[], validator: (p: Player, args: string, next: () => void) => void, callback?: () => void): Disconnectable {
        const cmd = (cmd: string, p: Player, args: string) => {
            if (gameCommand.includes(cmd)) {
                validator(p, args, callback)
            }
        }
        this.on("command", cmd)
        return {
            disconnect: () => this.off("command", cmd)
        }
    }

    /** Returns the data for provided setId. **/
    async getSetData(setId: number) {
        return scripts.getSetData(setId)
    }

    /** "Parents" a bot class to the game. **/
    async newBot(bot: Bot) {
        this.world.bots.push(bot)

        const botPacket = await scripts.botPacket(bot)

        return botPacket.broadcast()
    }

    async newTool(tool: Tool) {
        this.world.tools.push(tool)

        const toolPacket = await scripts.toolPacket.create(tool)

        return toolPacket.broadcast()
    }

    newBricks = this.loadBricks

    /** "Parents" a brick class to the game. You should do this after setting all the brick properties. */
    async newBrick(brick: Brick) {
        this.world.bricks.push(brick)

        const packet = await scripts.loadBricks([brick])

        return packet.broadcast()
    }

    /** Takes an array of bricks, and deletes them all from every client. This will modify world.bricks. */
    async deleteBricks(bricks: Brick[]) {
        const deletePacket = scripts.deleteBricks(bricks)

        for (const brick of bricks) {
            brick._cleanup()

            const index = this.world.bricks.indexOf(brick)
            if (index !== -1)
                this.world.bricks.splice(index, 1)
        }

        return deletePacket.broadcast()
    }

    /** Takes an array of teams and loads them to all clients.
     * @example
     * ```js
     * let teams = {
     *  redTeam: new Team("Red Team", "#f54242"),
     *  blueTeam: new Team("Blue Team", "#0051ff")
     * }
     * 
     * Game.newTeams(Object.values(teams))
     * ```
     */
    newTeams(teams: Array<Team>) {
        this.world.teams = this.world.teams.concat(teams)
        for (const team of teams) {
            scripts.teamPacket.create(team)
                .broadcast()
        }
    }

    async newTeam(team: Team) {
        this.world.teams.push(team)

        return scripts.teamPacket.create(team)
            .broadcast()
    }

    /** Takes an array of bricks and loads them to all clients. */
    async loadBricks(bricks: Array<Brick>) {
        this.world.bricks = this.world.bricks.concat(bricks)

        const brickPacket = await scripts.loadBricks(bricks)

        return brickPacket.broadcast()
    }

    async setDataLoaded(): Promise<SetData> {
        return new Promise((resolve, reject) => {
            if (this.setData.id) 
                return resolve(this.setData as SetData)
                
            if (this.serverSettings.local) 
                return reject(new Error("Cannot load setData when server is set to local mode."))

            this.once("setDataLoaded", (err) => {
                if (err) return reject(err)
                return resolve(this.setData as SetData)
            })
        })
    }

    async onPacket(filter: ((packetData: PacketData) => void)  | number | Array<number>, callback: (packetData: PacketData) => void) {
        const filterFunction = (data) => {
            if (typeof(filter) == "function") {
                callback = filter

                return callback(data)
            }

            if (typeof(filter) == "number" && data.packetId == filter)
                return callback(data)

            if (Array.isArray(filter) && filter.includes(data.packetId))
                return callback(data)
        }

        this.on("newPacket", filterFunction)

        return {
            disconnect: () => this.off("newPacket", filterFunction)
        }
    }

    /**
     * Sets the environment for every player in the game.
     * 
     * Patches the world.environment with keys containing new properties.
     * 
     * @example
     * ```js
     * Game.setEnvironment({ baseSize: 500 })
     * ```
     */
    async setEnvironment(environment: Partial<Environment>) {
        return scripts.setEnvironment(environment)
    }

    /**
     * Clears the map, and then calls loadBrk with the provided brk name.
     * Then it sets all the bricks in the game, spawns, and Game.map.
     * 
     * MapData: bricks, spawns, environment, tools, teams, etc is returned.
     * 
     * @example
     * ```js
     * setTimeout(async() => {
     *      // Load all bricks + spawns in the game
     *      let data = await Game.loadBrk("headquarters2.brk")
     *  
     *      // Set the environment details (loadBrk does not do this).
     *      Game.setEnvironment(data.environment)
     * 
     *      // This brk added spawns, let's respawn players so they aren't trapped in a brick.
     *      Game.players.forEach((player) => {
     *          player.respawn()
     *      })
     * 
     *      console.log(data)
     * }, 60000)
     * ```
     */
    async loadBrk(location: string): Promise<MapData> {
        if (!this.serverSettings.mapDirectory) throw new Error('Cannot use loadBrk without mapDirectory.')

        const mapDirectory = resolve(this.serverSettings.mapDirectory)
        const brkFile = join(mapDirectory, location)

        if (brkFile.indexOf(mapDirectory) !== 0)
            throw new Error('Cannot load .brk outside of map folder.')

        if (!brkFile.endsWith(".brk")) throw new Error("Map selected is not a .brk file. Aborting.")

        await this.clearMap()

        const brkData = await scripts.loadBrk(brkFile)

        this.world.bricks = brkData.bricks
        this.world.spawns = brkData.spawns

        const map = await scripts.loadBricks(this.world.bricks)
        if (map) await map.broadcast()

        return brkData
    }

    /**
     * Loads the brk file like Game.loadBrk, but returns the data rather than setting / modifying anything.
     * 
     * This is useful if you want to grab teams, bricks, etc from a brk, but don't want to modify the game yet.
     */
    async parseBrk(location: string): Promise<MapData> {
        if (!this.serverSettings.mapDirectory) throw new Error('Cannot use parseBrk without mapDirectory.')

        const mapDirectory = resolve(this.serverSettings.mapDirectory)
        const brkFile = join(mapDirectory, location)

        if (brkFile.indexOf(mapDirectory) !== 0)
            throw new Error('Cannot parse .brk outside of map folder.')

        if (!brkFile.endsWith(".brk")) throw new Error("Map selected is not a .brk file. Aborting.")

        return scripts.loadBrk(brkFile)
    }

    /**
     * Clears all of the bricks for every player connected. This wipes world.bricks, any new players who
     * join after this is ran will download no bricks from the server.
     */
    async clearMap() {
        for (const brick of this.world.bricks)
            brick._cleanup()

        this.world.bricks = []

        return new PacketBuilder(PacketEnums.ClearMap)
            .write("bool", true) // There's a bug with packets that contain no data.
            .broadcast()
    }

    bindToClose(callback: () => null): void {
        let ended = false

        const processExit = async () => {
            ended = true
            await callback()
            process.exit()
        }

        process.on("SIGINT", processExit)
        process.on("SIGTERM", processExit)

        process.on("exit", () => {
            if (!ended) callback()
        })
    }

    /**
     * Exits the server process, and terminates any running scripts.
     * @see {@link https://nodejs.org/api/process.html#process_process_exit_code} for more information.
    */
    shutdown(status = 0) {
        return process.exit(status)
    }

    /** Return the distance between two points. */
    pointDistance3D(p1: Vector3, p2: Vector3): number {
        // ((x2 - x1)^2 + (y2 - y1)^2 + (z2 - z1)^2)^1/2
        return Math.sqrt((Math.pow(p1.x - p2.x, 2)) + (Math.pow(p1.y - p2.y, 2)) + (Math.pow(p1.z - p2.z, 2)))
    }

    /**@hidden */
    async _newPlayer(p: Player) {
        p.socket.player = p

        p.authenticated = true

        this.players.push(p)

        this.emit("playerJoin", p)

        await p._joined().catch(console.error)

        this.emit("initialSpawn", p)
    }

    /**@hidden */
    async _playerLeft(p: Player) {
        if (p.authenticated) {
            const index = this.players.indexOf(p)
            this.players.splice(index, 1)

            this.emit("playerLeave", p)

            await p._left()
        }
    }
}

const GameObject = new Game()

export default GameObject

export * from "./Player"

import Player from "./Player"

import Team from "./Team"

import * as scripts from "../scripts"

import Brick from "./Brick"

import Bot from "./Bot"

import PacketBuilder, { PacketEnums } from "../net/PacketBuilder"

import Vector3 from "./Vector3"

import Tool from "./Tool"

import { GameSettings } from ".."