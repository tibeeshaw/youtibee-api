const express = require("express");
// const ytdl = require("ytdl-core");
const ytdlp = require("yt-dlp-exec");
// const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const cookies = process.env.YOUTUBE_COOKIES.replace(/;/g, "\n"); // Convert back to multiline
// const proxy = process.env.PROXY; // Replace with your proxy

const proxies = [
    "http://13.38.153.36:80",
    "http://13.37.89.201:80",
    "http://13.38.176.104:80",
];

function getRandomProxy() {
    return proxies[Math.floor(Math.random() * proxies.length)];
}

const proxy = getRandomProxy();


async function getVideoInfo(videoUrl) {
    try {
        const info = await ytdlp.exec(videoUrl, {
            dumpJson: true,
            cookies,  // Uses cookies for authentication
            proxy,           // Uses a proxy to bypass rate limits
        });
        return JSON.parse(info);
    } catch (error) {
        throw new Error(`Error fetching video info: ${error}`);
    }
}

const router = express.Router();

router.get("/download/audio", async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ error: "No video URL provided" });

    try {
        const info = await getVideoInfo(videoUrl);
        const title = info.title.replace(/[^a-zA-Z0-9]/g, "_"); // Safe filename
        const outputPath = path.resolve(__dirname, `../../downloads/${title}.mp3`);

        // Run yt-dlp to download audio
        const downloadProcess = ytdlp.exec(videoUrl, {
            format: "bestaudio",
            extractAudio: true,
            audioFormat: "mp3",
            cookies,
            proxy,
            output: outputPath,
        });

        downloadProcess.then(() => {
            res.download(outputPath, `${title}.mp3`, () => {
                fs.unlinkSync(outputPath); // Delete file after download
            });
        }).catch((error) => {
            console.error("Download error:", error);
            res.status(500).json({ error: "Failed to download video" });
        });

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Failed to retrieve video info" });
    }
});

module.exports = router;
