const express = require("express");
const crypto = require("crypto");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8000;

// AES-256-CBC Verschlüsselung
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, "hex"); // 32 Bytes
const IV = Buffer.from(process.env.IV, "hex"); // 16 Bytes

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32 || !IV || IV.length !== 16) {
    throw new Error("ENCRYPTION_KEY und IV müssen gesetzt sein!");
}

// Verschlüsseln
function encrypt(text) {
    const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, IV);
    let encrypted = cipher.update(text, "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return encrypted.toString("hex");
}

// Entschlüsseln
function decrypt(text) {
    const encrypted = Buffer.from(text, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, IV);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

// Whitelist laden
const WHITELIST_PATH = path.join(__dirname, "whitelist.txt");
function loadWhitelist() {
    if (!fs.existsSync(WHITELIST_PATH)) return [];
    return fs.readFileSync(WHITELIST_PATH, "utf8")
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith("//"));
}

let WHITELIST = loadWhitelist();
setInterval(() => { WHITELIST = loadWhitelist(); }, 60000); // Reload alle 60 Sekunden

app.use(cors());

// Normal Access Route
app.get("/api/normal-access", (req, res) => {
    const { roblox_username, roblox_id, creation_date } = req.query;

    if (!roblox_username || !roblox_id || !creation_date) {
        return res.status(400).json({ error: "Missing params" });
    }

    let matched = null;

    for (const entry of WHITELIST) {
        try {
            const r = JSON.parse(decrypt(entry));

            // Exakte Übereinstimmung aller drei Werte
            if (
                r.roblox_id === roblox_id &&
                r.username === roblox_username &&
                r.creation_date === Number(creation_date)
            ) {
                matched = {
                    is_whitelisted: true,
                    username: r.username,
                    roblox_id: r.roblox_id,
                    creation_date: r.creation_date,
                    discord_id: r.discord_id || null,
                    expires: r.expires || null
                };
                break;
            }
        } catch (e) {
            console.warn("Fehler beim Lesen eines Whitelist-Eintrags:", e);
        }
    }

    if (!matched) return res.status(403).json({ error: "Access Denied" });
    res.json(matched);
});

// Server starten
app.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});

// CLI: Whitelist-Eintrag generieren
if (require.main === module && process.argv[2] === "gen") {
    const obj = JSON.parse(process.argv[3]);
    const encrypted = encrypt(JSON.stringify(obj));
    console.log(encrypted);
    process.exit(0);
}
