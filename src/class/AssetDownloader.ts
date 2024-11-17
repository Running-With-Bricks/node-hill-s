const phin = require("phin")
    .defaults({ "timeout": 12000 })

const ASSET_API = (itemId: number) => `https://sandpile.xyz/api/getAsset/${itemId}`

export interface AssetData {
    mesh: string
    texture: string
    sound: string
}

export class AssetDownloader {
    cache: Record<number, AssetData>

    constructor() {
        this.cache = {}
    }

    async getAssetData(assetId: number): Promise<AssetData> {
        if (!assetId) return
        if (this.cache[assetId]) return this.cache[assetId]

        const assetData: AssetData = {
            mesh: null,
            texture: null,
            sound: null
        }

        let req

        try {
            req = (await phin({ url: ASSET_API(assetId),  parse: "json" })).body
            if (req.error) throw new Error(req.error.message)
        } catch {
            return Promise.reject(`AssetDownloader: Failure retrieving asset data for ${assetId}.`)
        }

        assetData.mesh = req.model
        assetData.texture = req.texture
        assetData.sound = req.sound

        this.cache[assetId] = Object.assign({}, assetData)

        return assetData
    }
}

const assetDownloader = new AssetDownloader()

export default assetDownloader