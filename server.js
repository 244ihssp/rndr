const express = require("express");
const crypto = require("crypto");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8000;

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
const IV = Buffer.from(process.env.IV, "hex");

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32 || !IV || IV.length !== 16) {
    throw new Error("ENCRYPTION_KEY (32 bytes hex) and IV (16 bytes hex) must be set!");
}

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
    if (!roblox_username || !roblox_id) {
        return res.status(400).json({ is_whitelisted: false, error: "Missing params" });
    }

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
                        expires: r.expires || null
                    };
                    break;
                }
            }
        } catch(e) {}
    }

    if (!matched) return res.status(403).json({ error: "Access Denied" });
    res.json(matched);
});

app.listen(PORT, () => {
    console.log(`Whitelist API läuft auf Port ${PORT}`);
});
