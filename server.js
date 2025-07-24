const express = require("express");
const axios = require("axios");
const app = express();
const PORT = process.env.PORT || 3000;

const GITHUB_RAW_URL = "https://raw.githubusercontent.com/DEIN_USERNAME/REPO_NAME/BRANCH/SKRIPT.lua";

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    next();
});

// Haupt-Endpunkt
app.get("/", async (req, res) => {
    try {
        const response = await axios.get(GITHUB_RAW_URL);
        res.type("text/plain").send(response.data);
    } catch (error) {
        res.status(500).send("Fehler beim Laden des Skripts.");
    }
});

app.listen(PORT, () => console.log(`Proxy läuft auf Port ${PORT}`));
