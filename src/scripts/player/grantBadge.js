const phin = require("phin")
    .defaults({
        url: "https://sandpile.xyz/api/grantBadgeItem",
        method: "POST",
        timeout: 12000
    })


async function playerGrantBadge(hostKey, validator, badgeId) {
    const { body } = await phin({
        data: { hostKey, validator, badgeId },
        parse: "json"
    })

    return body
}

module.exports = playerGrantBadge
