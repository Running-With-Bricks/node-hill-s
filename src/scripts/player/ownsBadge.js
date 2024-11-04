const phin = require("phin")
    .defaults({ parse: "json", timeout: 12000 })

const API = (userId, badgeId) => `https://sandpile.xyz/api/userOwnsBadge?userId=${userId}&badgeId=${badgeId}`

async function playerOwnsBadge(userId, badgeId) {
    return (await phin({url: API(userId, badgeId)})).body?.owns
}

module.exports = playerOwnsBadge
