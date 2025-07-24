const express = require("express");
const axios = require("axios");
const app = express();
const PORT = process.env.PORT || 3000;

const GITHUB_RAW_URL = "https://raw.githubusercontent.com/244ihssp/IlIIS/refs/heads/main/IlIlP";

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    next();
});

app.get("/", async (req, res) => {
    try {
        const response = await axios.get(GITHUB_RAW_URL);
        res.type("text/plain").send(response.data);
    } catch (error) {
        res.status(500).send("Error");
    }
});

app.listen(PORT, () => console.log(`Proxy: ${PORT}`));
