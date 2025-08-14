const express = require("express"),
      crypto = require("crypto"),
      cors = require("cors"),
      fs = require("fs"),
      path = require("path"),
      { Client, GatewayIntentBits } = require("discord.js");

const app = express();
const PORT = process.env.PORT || 8000;
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
const IV = Buffer.from(process.env.IV, "hex");
const GUILD_ID = process.env.GUILD_ID;
const BOOST_ROLE_ID = process.env.BOOST_ROLE_ID;
const BOT_TOKEN = process.env.BOT_TOKEN;

if(!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32 || !IV || IV.length !== 16)
    throw new Error("ENCRYPTION_KEY (32 bytes hex) and IV (16 bytes hex) must be set as environment variables.");

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
client.login(BOT_TOKEN);

function encrypt(text){
    const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, IV);
    let encrypted = cipher.update(text, "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return encrypted.toString("hex");
}

function decrypt(text){
    const encrypted = Buffer.from(text, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, IV);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

const WHITELIST_PATH = path.join(__dirname, "whitelist.txt");
function loadWhitelist() {
    return fs.existsSync(WHITELIST_PATH) 
        ? fs.readFileSync(WHITELIST_PATH, "utf8")
            .split(/\r?\n/)
            .map(e => e.trim())
            .filter(e => e && !e.startsWith("//"))
        : [];
}
let WHITELIST = loadWhitelist();
setInterval(() => { WHITELIST = loadWhitelist(); }, 60_000);

app.use(cors());

app.get("/api/normal-access", (req, res) => {
    const { roblox_username, roblox_id } = req.query;
    if(!roblox_username || !roblox_id)
        return res.status(400).json({ is_whitelisted: false, error: "Missing params" });

    let result = null;
    for(const entry of WHITELIST){
        try{
            const data = JSON.parse(decrypt(entry));
            if(data.roblox_id === roblox_id || data.username === roblox_username){
                const allowed = !data.expires || Date.now() < data.expires;
                if(allowed){
                    result = {
                        is_whitelisted: true,
                        matched_type: data.roblox_id === roblox_id ? "roblox_id" : "roblox_username",
                        matched_value: data.roblox_id === roblox_id ? roblox_id : roblox_username,
                        username: data.username || null,
                        roblox_id: data.roblox_id || null,
                        discord_id: data.discord_id || null,
                        expires: data.expires || null
                    };
                    break;
                }
            }
        }catch(e){}
    }
    if(!result) return res.status(403).json({ error: "Denied Access" });
    res.json(result);
});

app.get("/api/boost-access", async (req, res) => {
    const { discord_id, roblox_username, roblox_id } = req.query;
    if(!roblox_username || !roblox_id)
        return res.status(400).json({ is_whitelisted: false, has_boost_access: false, error: "Missing params" });

    let result = null;
    for(const entry of WHITELIST){
        try{
            const data = JSON.parse(decrypt(entry));
            const idMatch = data.roblox_id === roblox_id || data.username === roblox_username;
            const discordMatch = discord_id && data.discord_id === discord_id;
            const boostActive = data.boost_expires && Date.now() < data.boost_expires;

            if(idMatch){
                const hasBoost = discordMatch && boostActive;
                result = {
                    is_whitelisted: true,
                    has_boost_access: hasBoost,
                    matched_type: data.roblox_id === roblox_id ? "roblox_id" : "roblox_username",
                    matched_value: data.roblox_id === roblox_id ? roblox_id : roblox_username,
                    username: data.username || null,
                    roblox_id: data.roblox_id || null,
                    discord_id: data.discord_id || null,
                    boost_expires: hasBoost ? data.boost_expires : null
                };
                break;
            }

            if(discordMatch && boostActive){
                result = {
                    is_whitelisted: false,
                    has_boost_access: true,
                    matched_type: "discord_id",
                    matched_value: discord_id,
                    username: data.username || null,
                    roblox_id: data.roblox_id || null,
                    discord_id: data.discord_id || null,
                    boost_expires: data.boost_expires
                };
                break;
            }
        }catch(e){}
    }

    if(result && result.has_boost_access && discord_id){
        try{
            const guild = await client.guilds.fetch(GUILD_ID);
            const member = await guild.members.fetch(discord_id);
            if(!member.roles.cache.has(BOOST_ROLE_ID)){
                result.has_boost_access = false;
            }
        }catch(e){
            result.has_boost_access = false;
        }
    }

    if(!result || (discord_id && !result.has_boost_access))
        return res.status(403).json({ error: "Denied Access" });

    res.json(result);
});

app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });

if(require.main === module && process.argv[2] === "gen"){
    const data = JSON.parse(process.argv[3]);
    console.log(encrypt(JSON.stringify(data)));
    process.exit(0);
}
