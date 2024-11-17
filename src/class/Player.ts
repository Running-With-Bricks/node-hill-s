import { EventEmitter } from "events"
import net from "net"
import Game, { Environment, Disconnectable } from "./Game"
import Team from "./Team"
import Brick from "./Brick"
import * as scripts from "../scripts"

import PacketBuilder, { PacketEnums } from "../net/PacketBuilder"
import createPlayerIds from "../net/BrickHillPackets/playerIds"
import createAssetIds from "../net/BrickHillPackets/assetIds"

import Vector3 from "./Vector3"
import Outfit from "./Outfit"
import Tool from "./Tool"

import { KeyTypes } from "../util/keys/whitelisted"
import SoundEmitter from "./SoundEmitter"

export enum Client {
    /**The original client made by Luke */
    Classic = 0,
    /**Brickplayer by Ty */
    BrickPlayer = 1,
    /**Player2 by Ezcha */
    Player2 = 2,
}

export enum CameraType {
    /**The camera is fixed in place. You can set the position of it. */
    Fixed = "fixed",
    /**The camera is orbiting the cameraObject (a player). You cannot set the position of it. */
    Orbit = "orbit",
    /**The camera is free-floating, the player can move it with WASD. (Glitchy and really bad). */
    Free = "free",
    /**The player's camera is locked in first person. */
    First = "first",
}

export interface BodyColors {
    head: string,
    torso: string,
    leftArm: string,
    rightArm: string,
    leftLeg: string,
    rightLeg: string,
}

export interface Assets {
    tool: number,
    face: number,
    hat1: number,
    hat2: number,
    hat3: number,
    clothing1: number,
    clothing2: number,
    clothing3: number,
    clothing4: number,
    clothing5: number,
}

export enum PlayerEvents {
    InitialSpawn = "initialSpawn",
    Died = "died",
    Respawn = "respawn",
    AvatarLoaded = "avatarLoaded",
    Chatted = "chatted",
    Moved = "moved",
}

export interface ClientSocket extends net.Socket {
    _attemptedAuthentication: boolean
    _kickInProcess: boolean
    player: Player
    IPV4: string
    IP: string
    keepalive: {
        timer: NodeJS.Timeout | null
        keepAliveTime: number
        kickIdlePlayer: () => void
        restartTimer: () => void
    },
    _chunk: {
        recieve: Buffer
        remaining: number
        clear: () => void
    }
}

export default class Player extends EventEmitter {
    /** 
   * Fires once when the player fully loads. (camera settings, map loads, players downloaded, etc).
   * @event
   * @example
   * ```js
   * Game.on("playerJoin", (player) => {
    *    player.on("initialSpawn", () => {
    *        player.prompt("Hello there!")
    *    })
    * })
    * ```
   */

    static readonly initialSpawn = PlayerEvents.InitialSpawn

    /** 
   * Fires whenever a player dies (health set to 0).
   * @event
   * @example
   * ```js
   * Game.on("playerJoin", (player) => {
    *    player.on("died", () => {
    *        player.kick("This is a hardcore server.")
    *    })
    * })
    * ```
   */

    static readonly died = PlayerEvents.Died

    /** 
   * Fires whenever a player spawns (respawn() is called.)
   * @event
   * @example
   * ```js
   * Game.on("playerJoin", (player) => {
   *    player.on("respawn", () => {
   *        player.setHealth(1000)
   *    })
   * })
   * ```
   */

    static readonly respawn = PlayerEvents.Respawn

    /** 
   * Fires whenever a player's outfit loads.
   * @event
   * @example
   * ```js
   * Game.on("playerJoin", (player) => {
   *    player.on("avatarLoaded", () => {
   *        // The outfit is now loaded.
   *    })
   * })
   * ```
   */

    static readonly avatarLoaded = PlayerEvents.AvatarLoaded

    /** 
   * Fires whenever the player chats. Functionality-wise this behaves like `Game.on("chatted")`.
   * @event
   * @param message Message
   * @example
   * ```js
   * Game.on("playerJoin", (player) => {
   *    player.on("chatted", (message) => {
   *        // The player chatted.
   *    })
   * })
   * ```
   */
    static readonly chatted = PlayerEvents.Chatted

    /**
     * Fires whenever this player moves.
     * @event
     * @param newPosition The new position of the player
     * @param newRotation The new rotation of the player
     * ```js
     * player.on("moved", (newPosition, newRotation)=>{
     *    console.log(`${player.username} moved to ${newPosition.x}, ${newPosition.y}, ${newPosition.z}`)
     * })
     */
    static readonly moved = PlayerEvents.Moved

    readonly socket: ClientSocket

    authenticated: boolean

    readonly netId: number

    private _steps: Array<NodeJS.Timeout>

    private _positionDeltaTime: number

    /** The Brick Hill userId of the player. */
    readonly userId: number

    /** If the player is a Brick Hill admin (Does not work if local is set to true.)*/
    readonly admin: boolean

    /** The username of the player.*/
    readonly username: string

    /** The membershipType of the player. */
    readonly membershipType: number

    /** The player's client type */
    readonly client: Client

    /** The validation token of the player */
    readonly validationToken: string

    /** True if the player has left the game. */
    destroyed = false

    /** The current position of the player. */
    position: Vector3

    /** The current rotation of the player. */
    rotation: Vector3

    /** The current scale of the player. */
    scale: Vector3 = new Vector3(1, 1, 1)

    /** The current camera position of the player. */
    cameraPosition: Vector3

    /** The current camera rotation of the player. */
    cameraRotation: Vector3

    /** The camera field of view of the player. */
    cameraFOV: number

    /** The distance of how far the camera is away from the player. */
    cameraDistance: number

    /** The current camera type of the player. */
    cameraType: CameraType

    /** The player the camera is currently attached to. */
    cameraObject: Player

    /** An object containing all of the body colors the player has. */
    colors: BodyColors

    /** An object containing all of the assets the player is currently wearing. */
    assets: Assets

    /** An array containing userIds of players the player has blocked. Do NOT store player references in here. **/
    blockedUsers: Array<number>

    /** The value the player's health will be set to when they respawn. **/
    maxHealth = 100

    /** The current health of the player. */
    health: number

    /** If the player is alive or not. */
    alive: boolean

    /** If set to true, the server will reject any chat attempts from the player. **/
    muted = false

    /** The current speed of the player. */
    speed = 4

    /** How high the player can jump. */
    jumpPower = 5

    /** Gravity for player's physics. */
    gravity = 3

    /** The current score of the player. */
    score = 0

    /** The current speech bubble of the player. ("" = empty). */
    speech = ""

    /** The current team the player is on. */
    team: Team

    /** An array of tools the player has in their inventory. */
    inventory: Array<Tool>

    /** The current tool the player has equipped. */
    toolEquipped: Tool

    /** If set, the player's nametag color (in chat) will be set to the hex value you put. */
    chatColor: string

    /** If set to false, the player will not automatically load their avatar. */
    loadAvatar = true

    /** Used by the avatarLoaded() method to determine if the avatar already loaded. */
    _avatarLoaded = false

    /** If set to false, the player will not spawn with their tool equipped. \
     * loadAvatar MUST be enabled for this to work.*/
    loadTool = true

    /**
     * If set, player.respawn() will spawn the player in the value provided instead of a random location.
     * This property overrides spawnHandler.
     * @see {@link respawn}
     */
    spawnPosition?: Vector3

    /**
     * A function that will be called whenever player.respawn() is called.
     */
    spawnHandler: (player: Player) => Vector3

    /** An array containing all local bricks on the player's client. */
    localBricks?: Array<Brick>

    static playerId = 0

    constructor(socket: ClientSocket) {
        super()

        Player.playerId += 1

        this.socket = socket

        this.netId = Player.playerId

        this.localBricks = []

        this._steps = []

        this._positionDeltaTime = Date.now()

        this.inventory = []

        this.blockedUsers = []

        this.destroyed = false

        this.spawnHandler = scripts.pickSpawn

        this.position = new Vector3(0, 0, 0)

        this.rotation = new Vector3(0, 0, 0)

        this.scale = new Vector3(1, 1, 1)

        this.cameraFOV = 60

        this.cameraDistance = 5

        this.cameraPosition = new Vector3(0, 0, 0)

        this.cameraRotation = new Vector3(0, 0, 0)

        this.cameraType = CameraType.Fixed

        this.cameraObject = this

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

        this.maxHealth = 100

        this.health = this.maxHealth

        this.alive = false

        this.muted = false

        this.speed = 4

        this.speech = ""

        this.jumpPower = 5

        this.gravity = 3

        this.score = 0

        this.toolEquipped = null

        this.client = Client.Classic
    }

    /** 
   * Calls back whenever the player clicks.
   * @callback
   * @example
   * ```js
   * player.mouseclick(() => {
   *    // The player clicked.
   * })
   * ```
   */
    mouseclick(callback: () => void): Disconnectable {
        const clickCallback = () => {
            callback()
        }
        this.on("mouseclick", clickCallback)
        return {
            disconnect: () => this.off("mouseclick", clickCallback)
        }
    }

    /** 
   * Calls back whenever the player presses a key.
   * @deprecated New player.keyPressed and player.keyReleased api allows more functionality
   * @callback
   * @example
   * ```js
   * Game.on("initialSpawn", (player) => {
   *    player.speedCooldown = false
   * 
   *    player.keypress(async(key) => {
   *        if (player.speedCooldown) return
   *        if (key === "shift") {
   *            player.speedCooldown = true
   *            
   *            player.bottomPrint("Boost activated!", 3)
   *            
   *            player.setSpeed(8)
   * 
   *            await sleep(3000)
   * 
   *            player.setSpeed(4)
   * 
   *            player.bottomPrint("Boost cooldown...", 6)
   * 
   *            setTimeout(() => {
   *                player.speedCooldown = false
   *            }, 6000)
   *        }
   *    })
   * })
   * ```
   **/

    keypress(callback: (key: KeyTypes) => void): Disconnectable {
        const kpCallback = (key: KeyTypes) => {
            callback(key)
        }
        this.on("keypress", kpCallback)
        return {
            disconnect: () => this.off("keypress", kpCallback)
        }
    }


    /** 
   * Calls back whenever the player presses a key.
   * @callback
   **/

    keyPressed(key: KeyTypes, callback: () => void): Disconnectable {
        const kpCallback = (key2: KeyTypes) => {
            if (key === key2) callback()
        }
        this.on("keydown", kpCallback)
        scripts.addKeypress(this.socket,key)
        return {
            disconnect: () => this.off("keydown", kpCallback)
        }
    }

    /** 
   * Calls back whenever the player releases a key.
   * @callback
   **/

    keyReleased(key: KeyTypes, callback: () => void): Disconnectable {
        const kpCallback = (key2: KeyTypes) => {
            if (key === key2) callback()
        }
        this.on("keyup", kpCallback)
        scripts.addKeypress(this.socket,key)
        return {
            disconnect: () => this.off("keyup", kpCallback)
        }
    }

    /**
     * Kicks the player from the game.
     * @param message The kick message
     */
    async kick(message: string) {
        this.socket._kickInProcess = true

        return scripts.kick(this.socket, message)
    }

    /**
     * Clears all of the bricks for the player. This is a LOCAL change. \
     * world.bricks will not be updated!
     */
    async clearMap() {
        return new PacketBuilder(PacketEnums.ClearMap)
            .write("bool", true) // There's a bug with packets that contain no data.
            .send(this.socket)
    }

    private async _log(message: string, broadcast = false) {
        if (!Game.systemMessages) return

        if (broadcast)
            return scripts.message.messageAll(message)
        else
            return scripts.message.messageClient(this.socket, message)
    }

    private async _removePlayer() {
        return new PacketBuilder(PacketEnums.RemovePlayer)
            .write("uint32", this.netId)
            .broadcastExcept([this])
    }

    async topPrint(message: string, seconds: number) {
        return scripts.topPrint(this.socket, message, seconds)
    }

    async centerPrint(message: string, seconds: number) {
        return scripts.centerPrint(this.socket, message, seconds)
    }

    async bottomPrint(message: string, seconds: number) {
        return scripts.bottomPrint(this.socket, message, seconds)
    }

    /** Prompts a confirm window on the player's client. */
    async prompt(message: string) {
        return scripts.prompt(this.socket, message)
    }

    /**
     * Sends a local message to the player.
     * @param message The message
     */
    async message(message: string) {
        return scripts.message.messageClient(this.socket, message)
    }

    /** Sends a chat message to everyone, conforming to rate-limit / mute checks, etc. */
    async messageAll(message: string, generateTitle = true) {
        return scripts.message.clientMessageAll(this, message, generateTitle)
    }

    async setOutfit(outfit: Outfit) {
        const promises = []

        // Patch assets + colors
        Object.assign(this.assets, outfit.assets)
        Object.assign(this.colors, outfit.colors)

        promises.push(
            createPlayerIds(this, "KLMNOP").broadcast(),
            createAssetIds(this, outfit.idString).then(b => b.broadcast())
        )

        return Promise.all(promises)
    }

    /** Sets the players health. If the health provided is larger than maxHealth, maxHealth will automatically be \
     *  set to the new health value.
     */
    async setHealth(health: number) {
        if (health <= 0 && this.alive) {
            return this.kill()
        } else {
            if (health > this.maxHealth) this.health = this.maxHealth
            this.health = health
            return createPlayerIds(this, "e")
                .send(this.socket)
        }
    }

    async setScore(score: number) {
        if (isNaN(score)) throw 'Score must be a number.'

        this.score = Number(score)

        return createPlayerIds(this, "X")
            .broadcast()
    }

    async setTeam(team: Team) {
        this.team = team
        return createPlayerIds(this, "Y")
            .broadcast()
    }

    private _greet() {
        if (Game.MOTD) {
            this._log(Game.MOTD)
        }
        this._log(`\\c6[SERVER]: \\c0${this.username} has joined the server!`, true)
    }

    async setCameraPosition(position: Vector3) {
        this.cameraPosition = new Vector3().fromVector(position)
        return createPlayerIds(this, "567")
            .send(this.socket)
    }

    async setCameraRotation(rotation: Vector3) {
        this.cameraRotation = new Vector3().fromVector(rotation)
        return createPlayerIds(this, "89a")
            .send(this.socket)
    }

    async setCameraDistance(distance: number) {
        this.cameraDistance = distance
        return createPlayerIds(this, "4")
            .send(this.socket)
    }

    async setCameraFOV(fov: number) {
        this.cameraFOV = fov
        return createPlayerIds(this, "3")
            .send(this.socket)
    }

    async setCameraObject(player: Player) {
        this.cameraObject = player
        return createPlayerIds(this, "c")
            .send(this.socket)
    }

    async setCameraType(type: CameraType) {
        this.cameraType = type
        return createPlayerIds(this, "b")
            .send(this.socket)
    }

    /** Returns an arary of all the players currently blocking this user. */
    getBlockedPlayers() {
        const players = []

        for (const target of Game.players) {
            if (target.blockedUsers.includes(this.userId))
                players.push(target)
        }

        return players
    }

    /** Adds the tool to the user's inventory. */
    async addTool(tool: Tool) {
        if (this.inventory.includes(tool))
            return Promise.reject("Player already has tool equipped.")

        this.inventory.push(tool)

        const toolPacket = await scripts.toolPacket.create(tool)

        return toolPacket.send(this.socket)
    }

    /** Unequips the tool (if equipped), and removes it from player's inventory. */
    async removeTool(tool: Tool) {
        const index = this.inventory.indexOf(tool)

        if (index === -1) return // Tool not found.

        this.inventory.splice(index, 1)

        this.unequipTool(tool)

        return scripts.toolPacket.destroy(tool)
            .send(this.socket)
    }

    /** Takes an array of bricks and loads them to the client locally. */
    async loadBricks(bricks: Array<Brick>) {
        this.localBricks = this.localBricks.concat(bricks)

        const loadBricks = await scripts.loadBricks(bricks)

        return loadBricks.send(this.socket)
    }

    /** Takes an array of sound emitters and loads them to the client locally. */
    async loadSounds(sounds: Array<SoundEmitter>) {
        const loadSounds = await scripts.loadSounds(sounds)

        return loadSounds.send(this.socket)
    }

    /** Takes an array of bricks, and deletes them all from this client. */
    async deleteBricks(bricks: Brick[]) {
        for (const brick of bricks) {
            const index = this.localBricks.indexOf(brick)
            if (index !== -1)
                this.localBricks.splice(index, 1)
        }
        return scripts.deleteBricks(bricks)
            .send(this.socket)
    }

    /**
     * @deprecated
     * Same as player.removeTool
     */
    destroyTool = this.removeTool

    /** Equips the tool, if It's not already in the user's inventory it will be added first. \
     * If you call this on a tool that is already equipped, it will be unequipped.
     */
    async equipTool(tool: Tool) {
        // They don't have the tool, add it first.
        if (!this.inventory.includes(tool))
            await this.addTool(tool)

        const currentTool = this.toolEquipped

        // Tool is already equpped, unequip it.
        if (currentTool === tool)
            return this.unequipTool(tool)

        // The player switched tools, inform the other one it's unequipped.
        if (currentTool)
            await this.unequipTool(currentTool)

        this.toolEquipped = tool

        tool.emit("equipped", this)

        const packet = await createAssetIds(this, "g")

        return packet.broadcast()
    }

    /** Unequips the tool from the player, but does not remove it from their inventory. */
    async unequipTool(tool: Tool) {
        if (this.toolEquipped !== tool)
            return

        this.toolEquipped = null

        tool.emit("unequipped", this)

        return createPlayerIds(this, "h")
            .broadcast()
    }

    async setSpeech(speech = "") {
        this.speech = speech
        return createPlayerIds(this, "f")
            .broadcastExcept(this.getBlockedPlayers())
    }

    async setSpeed(speedValue: number) {
        this.speed = speedValue
        return createPlayerIds(this, "1")
            .send(this.socket)
    }

    async setJumpPower(power: number) {
        this.jumpPower = power
        return createPlayerIds(this, "2")
            .send(this.socket)
    }

    async setGravity(gravityValue: number) {
        this.gravity = gravityValue
        return createPlayerIds(this, "o")
            .send(this.socket)
    }

    private async _getClients() {
        // There are no other clients to get.
        if (Game.players.length <= 1) return

        const others = Game.players.filter(p => p !== this)

        if (others.length <= 0) return

        const promises = []

        // Send all other clients this client.
        const otherClientsPacket = new PacketBuilder(PacketEnums.SendPlayers)
            .write("uint8" , 1)
            .write("uint32", this.netId)
            .write("string", this.username)
            .write("uint32", this.userId)
            .write("bool"  , this.admin)
            .write("uint8" , this.membershipType)

        promises.push(otherClientsPacket.broadcastExcept([this]))

        const sendPlayersPacket = new PacketBuilder(PacketEnums.SendPlayers)

        sendPlayersPacket.write("uint8", others.length)

        // Send this client all other clients.
        for (const player of others) {
            sendPlayersPacket.write("uint32", player.netId)
            sendPlayersPacket.write("string", player.username)
            sendPlayersPacket.write("uint32", player.userId)
            sendPlayersPacket.write("bool"  , player.admin)
            sendPlayersPacket.write("uint8" , player.membershipType)
        }

        promises.push(sendPlayersPacket.send(this.socket))

        return Promise.all(promises)
    }

    /**@hidden */
    async _updatePositionForOthers(pos: Array<number>) {
        if (Date.now() - this._positionDeltaTime < 50)
            return

        this._positionDeltaTime = Date.now()

        let idBuffer = ""

        if (pos[0] && this.position.x != pos[0]) {
            idBuffer += "A"
            this.position.x = pos[0]
        }

        if (pos[1] && this.position.y != pos[1]) {
            idBuffer += "B"
            this.position.y = pos[1]
        }

        if (pos[2] && this.position.z != pos[2]) {
            idBuffer += "C"
            this.position.z = pos[2]
        }

        if (pos[3] && this.rotation.z != pos[3]) {
            idBuffer += "F"
            this.rotation.z = pos[3]
        }

        if (pos[4] && this.rotation.x != pos[4]) {
            this.cameraRotation.x = pos[4]
        }

        if (idBuffer.length) {
            this.emit("moved", this.position, this.rotation.z)

            return createPlayerIds(this, idBuffer)
                .broadcastExcept([this])
        }
    }

    /**Clones a brick locally to the player's client, returns the newly created local brick. */
    async newBrick(brick: Brick) {
        const localBrick = brick.clone()

        localBrick.socket = this.socket

        this.localBricks.push(localBrick)

        const packet = await scripts.loadBricks([localBrick])

        await packet.send(this.socket)

        return localBrick
    }

    /**Clones an array of bricks locally to the player's client, returns an array containing the cloned bricks. */
    async newBricks(bricks: Array<Brick>) {
        const localBricks = []

        for (const brick of bricks) {
            const localBrick = brick.clone()
            localBrick.socket = this.socket
            this.localBricks.push(localBrick)
            localBricks.push(localBrick)
        }

        const packet = await scripts.loadBricks(localBricks)

        await packet.send(this.socket)

        return localBricks
    }

    async setPosition(position: Vector3) {
        this.position = new Vector3().fromVector(position)

        this.emit("moved", this.position, this.rotation.z)

        const packetBuilder = createPlayerIds(this, "ABCF")

        return packetBuilder.broadcast()
    }

    async setScale(scale: Vector3) {
        this.scale = new Vector3().fromVector(scale)

        const packetBuilder = createPlayerIds(this, "GHI")

        return packetBuilder.broadcast()
    }

    /**
     * Sets the appearance of the player. \
     * If a userId isn't specified, it will default to the player's userId.
     * 
     * Error handling is highly recommended as this function makes a HTTP request.
     */
    async setAvatar(userId: number) {
        const promises = []

        await scripts.setAvatar(this, userId)

        const playerPacket = createPlayerIds(this, "KLMNOP")

        const assetPacket = createAssetIds(this, "QUVWjklmn")

        promises.push(
            playerPacket.broadcast(),
            assetPacket.then(p => p.broadcast())
        )

        return Promise.all(promises)
    }

    async avatarLoaded(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._avatarLoaded) return resolve()

            this.once("avatarLoaded", (err) => {
                if (err) return reject(err)
                return resolve()
            })
        })
    }

    /**
   * Returns player stats in JSON from this API: \
   * https://sandpile.xyz/api/getUserInfoById/?id={userId}
   * @example
   * ```js
   * Game.on("playerJoin", async(player) => {
   *  const data = await player.getUserInfo()
   *  console.log(data)
   * })
  * ```
   */
    async getUserInfo(): Promise<JSON> {
        return scripts.getUserInfo(this.userId)
    }

    /**
     * Returns true or false if the player owns a specified assetId.
     * 
     * @example
     * ```js
     * Game.on("initialSpawn", async(p) => {
     *      let ownsAsset = await p.ownsAsset(106530)
     *      console.log("Player owns asset: ", ownsAsset)
     * })
    ``` 
     */
    async ownsAsset(assetId: number): Promise<boolean> {
        return scripts.playerOwnsAsset(this.userId, assetId)
    }

    /**
     * Returns true or false if the player owns a specified badgeId.
     * 
     * @example
     * ```js
     * Game.on("initialSpawn", async(p) => {
     *      let ownsBadge = await p.ownsBadge(1256)
     *      console.log("Player owns badge: ", ownsBadge)
     * })
    ``` 
     */
    async ownsBadge(badgeId: number): Promise<boolean> {
        return scripts.playerOwnsBadge(this.userId, badgeId)
    }

    /**
     * Grants a badge to the player. Note that the badge must be offsale to be grantable.
     * 
     * @example
     * ```js
     * Game.on("initialSpawn", async(p) => {
     *      let response = await p.grantBadge(1256)
     *      console.log("Grant response: ", response)
     * })
    ``` 
     */
    async grantBadge(badgeId: number): Promise<boolean> {
        return scripts.playerGrantBadge(Game.serverSettings.hostKey, this.validationToken, badgeId)
    }

    // /**
    //  * Returns JSON data of total value and direction of users crate \
    //  * https://api.brick-hill.com/v1/user/1/value
    //  * 
    //  * @example
    //  * ```js
    //  * Game.on("playerJoin", async(p) => {
    //  *  let worth = await p.getValue(1524)
    //  *  console.log("Player is worth: ", worth.value)
    //  * })
    // ``` 
    //  */
    // async getValue(): Promise<JSON> {
    //     return scripts.getPlayerValue(this.userId)
    // }

    // /**
    //  * Returns JSON data of the users rank in a group, or false if they aren't in the group. \
    //  * https://api.brick-hill.com/v1/clan/member?id=1&user=1
    //  * @example
    //  * ```js
    //  * Game.on("playerJoin", async(player) => {
    //  *  const groupData = await player.getRankInGroup(5)
    //  *  if (groupData) {
    //  *      console.log(groupData)
    //  *  } else {
    //  *      console.log("Player is not in group.")
    //  *  }
    //  * })
    // * ```
    //  */
    // async getRankInGroup(groupId: number): Promise<JSON | boolean> {
    //     return scripts.getRankInGroup(groupId, this.userId)
    // }

    async kill() {
        if (!this.alive) return

        const promises = []

        this.alive = false

        this.health = 0

        const killPacket = new PacketBuilder(PacketEnums.Kill)
            .write("uint32", this.netId)
            .write("bool", true)

        const healthPacket = createPlayerIds(this, "e")

        promises.push(
            killPacket.broadcast(),
            healthPacket.send(this.socket)
        )

        this.emit("died")

        return Promise.all(promises)
    }

    /** Respawns the player. */
    async respawn() {
        const promises = []

        let newSpawnPosition

        if (this.spawnPosition) {
            newSpawnPosition = this.spawnPosition
        } else {
            newSpawnPosition = await this.spawnHandler(this) || scripts.pickSpawn()
        }

        await this.setPosition(newSpawnPosition)

        const killPacket = new PacketBuilder(PacketEnums.Kill)
            .write("uint32", this.netId)
            .write("bool", false)

        this.alive = true

        this.health = this.maxHealth

        this.cameraType = CameraType.Orbit

        this.cameraObject = this

        this.cameraPosition = new Vector3(0, 0, 0)

        this.cameraRotation = new Vector3(0, 0, 0)

        this.cameraFOV = 60

        this.toolEquipped = null

        promises.push(
            killPacket.broadcast(),
            createPlayerIds(this, "ebc56789a3h").send(this.socket)
        )

        this.emit("respawn")

        return Promise.all(promises)
    }

    /**
     * Identical to setInterval, but will be cleared after the player is destroyed.
     * Use this if you want to attach loops to players, but don't want to worry about clearing them.
     * @param callback The callback function.
     * @param delay The delay in milliseconds.
     */
    setInterval(callback: () => void, delay: number): NodeJS.Timeout {
        const loop = setInterval(callback, delay)
        this._steps.push(loop)
        return loop
    }

    /**
     * Functionally the same to Game.setEnvironment, but sets the environment only for one player.
     * @example
     * ```js
     * Game.on("playerJoin", (p) => {
     *  p.setEnvironment( {skyColor: "6ff542"} )
     * })
     */
    async setEnvironment(environment: Partial<Environment>) {
        return scripts.setEnvironment(environment, this.socket)
    }

    private _createFigures() {
        // Update player's figure for others
        createPlayerIds(this, "ABCDEFGHIKLMNOPXYf")
            .broadcastExcept([this])
        createAssetIds(this, "QUVWgjklmn").then((packet) => {
            packet.broadcastExcept([this])
        })
        // Update other figures for this player
        for (const player of Game.players) {
            if (player !== this) {
                createPlayerIds(player, "ABCDEFGHIKLMNOPXYf")
                    .send(this.socket)
                createAssetIds(player, "QUVWgjklmn").then((packet) => {
                    packet.send(this.socket)
                })
            }
        }
    }

    private _createTools() {
        for (const tool of Game.world.tools) {
            this.addTool(tool)
        }
    }

    private _createTeams() {
        for (const team of Game.world.teams) {
            scripts.teamPacket.create(team)
                .send(this.socket)
        }
    }

    private _createBots() {
        for (const bot of Game.world.bots)
            scripts.botPacket(bot).then(b => b.send(this.socket))
    }

    /**@hidden */
    async _left() {
        this.destroyed = true

        console.log(`${this.username} has left the game.`)

        this._log(`\\c6[SERVER]: \\c0${this.username} has left the server!`, true)

        this.removeAllListeners()

        this._steps.forEach((loop) => {
            clearInterval(loop)
        })

        await this._removePlayer()
    }

    /**@hidden */
    async _joined() {
        // Send player their information + brick count.
        await scripts.sendAuthInfo(this)

        await this._getClients()

        console.log(`${this.username} has joined | netId: ${this.netId}`)

        this._greet()

        await this.setEnvironment(Game.world.environment)

        if (Game.sendBricks) {
            const map = await scripts.loadBricks(Game.world.bricks)
            if (map) await map.send(this.socket)
        }

        const sounds = await scripts.loadSounds(Game.world.sounds)
        if (sounds) await sounds.send(this.socket)

        this._createTeams()

        this._createTools()

        this._createBots()

        if (Game.assignRandomTeam && Game.world.teams.length)
            this.setTeam(Game.world.teams[Math.floor(Math.random() * Game.world.teams.length)])

        if (Game.playerSpawning)
            await this.respawn()

        this._createFigures()

        if (this.loadAvatar) {
            this.setAvatar(this.userId)
                .then(() => {
                    this.emit("avatarLoaded")
                    this._avatarLoaded = true
                    if (this.loadTool && this.assets.tool) {
                        const tool = new Tool("Tool")
                        tool.model = this.assets.tool
                        this.addTool(tool)
                    }
                })
                .catch((err) => {
                    console.error(`Failure loading avatar appearance for ${this.username}: \n`, err.stack)
                    this.emit("avatarLoaded", err)
                })
        }

        this.mouseclick(() => {
            this.toolEquipped && this.toolEquipped.emit("activated", this)
        })

        this.socket.keepalive.restartTimer()

        this.emit("initialSpawn")
    }
}