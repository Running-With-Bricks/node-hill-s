const phin = require("phin")
    .defaults({ parse: "json", timeout: 12000 })

const API = "https://sandpile.xyz/api/getSetData/"

async function getSetData(setId) {
    const setData = (await phin({url: API + parseInt(setId)})).body
    return setData.data
}

module.exports = getSetData