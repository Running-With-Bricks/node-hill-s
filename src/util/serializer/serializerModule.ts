import * as zlib from "zlib"

import Brick from "../../class/Brick"

import Vector3 from "../../class/Vector3"

const DEFAULT_BRICK = new Brick()

/**A module used for serializing bricks into a storeable-data format.
 * 
 * Can be used for saving user build creations.
 * 
 * @example
 * ```js
 * const MAP_DATABASE = new Enmap({
 *       name: "mapBuffer",
 *       autoFetch: true,
 *       fetchAll: false
 *   });
 *
 *   // Save the data if it isn't already saved.
 *   if (!MAP_DATABASE.has("mapBuffer")) {
 *       console.log("Map not found, saving it ...")
 *       
 *       let { bricks } = Game.parseBrk("./maps/headquarters2.brk")
 *
 *       let data = util.serialize.serialize(bricks)
 *
 *       MAP_DATABASE.set("mapBuffer", data)
 *   }
 *
 *   // Clear the map
 *   Game.clearMap()
 *
 *   Game.on("initialSpawn", (p) => {
 *       let mapData = Buffer.from(MAP_DATABASE.get("mapBuffer"))
 *
 *       mapData = util.serialize.deserialize(mapData)
 *
 *       p.loadBricks(mapData)
 *   })
 *   ```
 */
function serialize(bricks: Brick[]): Buffer {
    let binaryData: any = []

    bricks.forEach((brick) => {
        const data: any = {}

        if (!brick.position.equalsVector(DEFAULT_BRICK.position))
            data.position = [brick.position.x, brick.position.y, brick.position.z]

        if (!brick.scale.equalsVector(DEFAULT_BRICK.scale))
            data.scale = [brick.scale.x, brick.scale.y, brick.scale.z]

        if (brick.color !== DEFAULT_BRICK.color)
            data.color = brick.color

        if (brick.visibility < 1)
            data.visibility = brick.visibility

        if (!brick.collision)
            data.collision = false

        if (brick.name)
            data.name = brick.name

        if (!brick.rotation.equalsVector(DEFAULT_BRICK.rotation))
            data.rotation = [brick.rotation.x, brick.rotation.y, brick.rotation.z]

        if (brick.model)
            data.model = brick.model

        if (brick.lightEnabled) {
            data.lightEnabled = true
            data.lightColor = brick.lightColor
            data.lightRange = brick.lightRange
        }

        if (brick.clickable) {
            data.clickable = true
            data.clickDistance = brick.clickDistance
        }

        binaryData.push(data)
    })

    binaryData = JSON.stringify(binaryData)

    binaryData = zlib.deflateSync(binaryData)

    return binaryData
}

function deserialize(data: Buffer): Brick[] {
    data = zlib.inflateSync(data)

    data = JSON.parse(data.toString("ascii"))

    const bricks = []

    data.forEach((brick: any) => {
        const newBrick = new Brick(brick.position, brick.scale, brick.color)

        Object.keys(brick).forEach((prop) => {
            // Convert objects into Vector3s
            if (typeof brick[prop] === "object")
                brick[prop] = new Vector3(...brick[prop])

            newBrick[prop] = brick[prop]
        })

        bricks.push(newBrick)
    })

    return bricks
}

export default { serialize, deserialize }
