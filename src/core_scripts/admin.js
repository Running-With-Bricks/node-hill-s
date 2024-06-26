const CoreScript = require("./coreMethods").default

const cs = new CoreScript("admin")

cs.properties = {
    autoLoad: true,
}

/*eslint no-undef: "off"*/
function loadAdmin(options) {
    require("nh-admin")

    if (typeof options === "object")
        Object.assign(Game.cheatsAdmin, options)

    Game.emit("cheatsAdminLoaded")

    if (Game.serverSettings.local) {
        Game.on("playerJoin", (p) => Game.cheatsAdmin.owners.add(p.userId))
        return
    }

    if (!cs.properties.autoLoad) return

    Game.setDataLoaded().then(() => {
        Game.cheatsAdmin.owners.add(Game.setData.creator.id)
        console.log(`[cheatsAdmin] Set game creator ${Game.setData.creator.username} as admin.`)
    })
}

initCheatsAdmin = loadAdmin

Game.once("scriptsLoaded", () => {
    if (cs.properties.autoLoad)
        loadAdmin()
})