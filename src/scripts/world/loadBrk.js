const fs = require("fs")
const Game = require("../../class/Game").default
const Team = require("../../class/Team").default
const Tool = require("../../class/Tool").default
const Brick = require("../../class/Brick").default
const Vector3 = require("../../class/Vector3").default
const { rgbToHex, convertRGB } = require("../../util/color/colorModule").default

async function loadBrk(map) {
    const FILE = await fs.promises.readFile(map, "UTF-8")

    const LINES = FILE.split("\n")

    let totalLines = 0

    const bricks = []

    const spawns = []

    const tools = []

    const teams = []

    const environment = {}

    let currentBrick = -1

    let scriptWarning = false // Doesn't load scripts, just notifies if the .brk contains scripts

    for (let line of LINES) {

        totalLines++

        line = line.trim()

        // Set up environment details
        switch (totalLines) {
            case 1: {
                if (line !== "B R I C K  W O R K S H O P  V0.2.0.0") {
                    console.error("ERROR: This set was created using an incompatible version of Brick Hill.")
                    return process.exit(0)
                }
                continue
            }
            case 3: {
                const glColor = line.split(" ")
                const RGB = convertRGB(glColor[0], glColor[1], glColor[2])
                environment["ambient"] = rgbToHex(RGB[2], RGB[1], RGB[0])
                continue
            }
            case 4: {
                const glColor = line.split(" ")
                const RGB = convertRGB(glColor[0], glColor[1], glColor[2])
                environment["baseColor"] = rgbToHex(RGB[2], RGB[1], RGB[0])
                continue
            }
            case 5: { // This isn't BGR because ... ?
                const glColor = line.split(" ")
                const RGB = convertRGB(glColor[0], glColor[1], glColor[2])
                environment["skyColor"] = rgbToHex(RGB[0], RGB[1], RGB[2])
                continue
            }
            case 6: {
                environment["baseSize"] = Number(line)
                continue
            }
            case 7: {
                environment["sunIntensity"] = Number(line)
                continue
            }
        }

        const DATA = line.split(" ")

        const ATTRIBUTE = DATA[0].replace("+", "")

        const VALUE = DATA.slice(1).join(" ")

        switch (ATTRIBUTE) {
            case "NAME": {
                bricks[currentBrick].name = VALUE
                continue
            }
            case "ROT": {
                const rot = VALUE.split(" ").map(val => Number(val))
                if (rot.length === 1) {
                    bricks[currentBrick].rotation = new Vector3(0, 0, (rot[0] % 90) != 0 ? rot[0] + 90 : 0)
                } else {
                    bricks[currentBrick].rotation = new Vector3(rot[0], rot[1], rot[2])
                }
                continue
            }
            case "SHAPE": {
                bricks[currentBrick].shape = VALUE
                if (VALUE === "spawnpoint")
                    spawns.push(bricks[currentBrick])
                continue
            }
            case "MODEL": {
                bricks[currentBrick].model = Number(VALUE)
                continue
            }
            case "NOCOLLISION": {
                bricks[currentBrick].collision = false
                continue
            }
            case "COLOR": {
                const colors = VALUE.split(" ")
                const color = convertRGB(colors[0], colors[1], colors[2])
                const team = new Team(
                    teams[teams.length - 1],
                    rgbToHex(
                        color[0],
                        color[1],
                        color[2]
                    )
                )
                teams[teams.length - 1] = team
                continue
            }
            case "LIGHT": {
                const colors = VALUE.split(' ')
                const lightRange = colors[3]
                const RGB = convertRGB(colors[0], colors[1], colors[2])
                bricks[currentBrick].lightEnabled = true
                bricks[currentBrick].lightRange = lightRange
                bricks[currentBrick].lightColor = rgbToHex(RGB[0], RGB[1], RGB[2])
                continue
            }
            case "SCRIPT": {
                if (scriptWarning) continue
                scriptWarning = true
                console.warn("WARNING: This set contains scripts. Scripts are incompatible with node-hill so they will not be loaded.")
                continue
            }
        }

        if (DATA.length === 10) {
            const RGB = convertRGB(DATA[6], DATA[7], DATA[8]), // Convert to OpenGL colour format
                xPos = Number(DATA[0]),
                yPos = Number(DATA[1]),
                zPos = Number(DATA[2]),
                xScale = Number(DATA[3]),
                yScale = Number(DATA[4]),
                zScale = Number(DATA[5]),
                color = rgbToHex(
                    RGB[0],
                    RGB[1],
                    RGB[2]
                ),
                transparency = Number(DATA[9])

            const newBrick = new Brick(
                new Vector3(xPos, yPos, zPos),
                new Vector3(xScale, yScale, zScale),
                color
            )

            newBrick.visibility = transparency

            bricks.push(newBrick)

            currentBrick++
        }

        if (DATA[0] && DATA[0] === ">TEAM")
            teams.push(VALUE)

        if (DATA[0] && DATA[0] === ">SLOT")
            tools.push(new Tool(VALUE))
    }

    environment.weather = Game.world.environment.weather

    return {
        teams: teams,
        tools: tools,
        bricks: bricks,
        environment: environment,
        spawns: spawns
    }
}

module.exports = loadBrk