const express = require("express");
const axios = require("axios");
const app = express();
const PORT = process.env.PORT || 3000;

res.header("Access-Control-Allow-Origin", "*");
res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

// URLs
const GITHUB_RAW_URL = "https://raw.githubusercontent.com/244ihssp/IlIIS/main/IlIlP";
const WHITELIST_URL = "https://raw.githubusercontent.com/lkjhg969/ffdsf/refs/heads/main/wl.txt";

// Dynamische Whitelist
async function loadWhitelist() {
    try {
        const response = await axios.get(WHITELIST_URL);
        return response.data.split("\n").map(user => user.trim());
    } catch (error) {
        console.error("WL konnte nicht geladen werden:", error);
        return [];
    }
}

// Haupt-Endpunkt
app.get("/", async (req, res) => {
    const username = req.query.username;
    const whitelist = await loadWhitelist();

    if (!username || !whitelist.includes(username)) {
        return res.status(403).send("Nicht in der WL.");
    }

    try {
        const script = await axios.get(GITHUB_RAW_URL);
        res.type("text/plain").send(script.data);
    } catch (error) {
        res.status(500).send("Skript konnte nicht geladen werden.");
    }
});

app.listen(PORT, () => console.log(`WL-Proxy läuft auf ${PORT}`));
