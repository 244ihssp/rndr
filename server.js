const express = require("express");
const crypto = require("crypto");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();
const PORT = process.env.PORT || 8000;

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
const IV = Buffer.from(process.env.IV, "hex");
const GUILD_ID = process.env.GUILD_ID;
const BOOST_ROLE_ID = process.env.BOOST_ROLE_ID;
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32 || !IV || IV.length !== 16) throw new Error("ENCRYPTION_KEY und IV müssen gesetzt sein!");

const discordClient = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
discordClient.login(BOT_TOKEN);

function encrypt(text) {
    const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, IV);
    let encrypted = cipher.update(text, "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return encrypted.toString("hex");
}

function decrypt(text) {
    const encrypted = Buffer.from(text, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, IV);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

const WHITELIST_PATH = path.join(__dirname, "whitelist.txt");

function loadWhitelist() {
    if (!fs.existsSync(WHITELIST_PATH)) return [];
    return fs.readFileSync(WHITELIST_PATH, "utf8")
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith("//"));
}

let WHITELIST = loadWhitelist();
setInterval(() => { WHITELIST = loadWhitelist(); }, 60000);

app.use(cors());

app.get("/api/normal-access", (req, res) => {
    const { roblox_username, roblox_id } = req.query;
    if (!roblox_username || !roblox_id) return res.status(400).json({ is_whitelisted: false, error: "Missing params" });

    let matched = null;

    for (const entry of WHITELIST) {
        try {
            const r = JSON.parse(decrypt(entry));
            if (r.roblox_id === roblox_id || r.username === roblox_username) {
                const isActive = !r.expires || Date.now() < r.expires;
                if (isActive) {
                    matched = {
                        is_whitelisted: true,
                        matched_type: r.roblox_id === roblox_id ? "roblox_id" : "roblox_username",
                        matched_value: r.roblox_id === roblox_id ? roblox_id : roblox_username,
                        username: r.username || null,
                        roblox_id: r.roblox_id || null,
                        discord_id: r.discord_id || null,
                        creation_date: r.creation_date || null,
                        expires: r.expires || null
                    };
                    break;
                }
            }
        } catch(e){}
    }

    if (!matched) return res.status(403).json({ error: "Denied Access" });
    res.json(matched);
});

app.get("/api/boost-access", async (req, res) => {
    const { discord_id, roblox_username, roblox_id } = req.query;
    if (!roblox_username || !roblox_id) return res.status(400).json({ is_whitelisted: false, has_boost_access: false, error: "Missing params" });

    let result = null;
    let guild;
    try { guild = await discordClient.guilds.fetch(GUILD_ID); } catch { return res.status(500).json({ error: "Discord Guild not found" }); }

    let member = null;
    if (discord_id) {
        try { member = await guild.members.fetch(discord_id); } catch {}
    }

    for (const entry of WHITELIST) {
        try {
            const r = JSON.parse(decrypt(entry));
            const matchesUser = r.roblox_id === roblox_id || r.username === roblox_username;
            const matchesDiscord = discord_id && r.discord_id === discord_id;
            let boostActive = false;
            if (member) boostActive = member.roles.cache.has(BOOST_ROLE_ID);
            if (!boostActive && r.boost_expires) boostActive = Date.now() < r.boost_expires;

            if (matchesUser || matchesDiscord) {
                result = {
                    is_whitelisted: matchesUser,
                    has_boost_access: boostActive,
                    matched_type: matchesUser ? (r.roblox_id === roblox_id ? "roblox_id" : "roblox_username") : "discord_id",
                    matched_value: matchesUser ? (r.roblox_id === roblox_id ? roblox_id : roblox_username) : discord_id,
                    username: r.username || null,
                    roblox_id: r.roblox_id || null,
                    discord_id: r.discord_id || null,
                    creation_date: r.creation_date || null,
                    boost_expires: boostActive && r.boost_expires ? r.boost_expires : null
                };
                break;
            }
        } catch(e){}
    }

    if (!result || (discord_id && !result.has_boost_access)) return res.status(403).json({ error: "Denied Access" });
    res.json(result);
});

app.listen(PORT, () => { console.log(`Server läuft auf Port ${PORT}`); });

if (require.main === module && process.argv[2] === "gen") {
    const obj = JSON.parse(process.argv[3]);
    const encrypted = encrypt(JSON.stringify(obj));
    console.log(encrypted);
    process.exit(0);
}
