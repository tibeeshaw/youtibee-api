const express = require("express");
const ytdl = require("ytdl-core");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs");
const cookies = process.env.YOUTUBE_COOKIES.replace(/;/g, "\n"); // Convert back to multiline

const router = express.Router();

router.get("/download/audio", async (req, res) => {
    const videoUrl = req.query.url; // YouTube video URL from frontend
    if (!videoUrl) return res.status(400).json({ error: "No video URL provided" });

    try {
        const info = await ytdl.getInfo(videoUrl);
        const title = info.videoDetails.title.replace(/[^a-zA-Z0-9]/g, "_"); // Safe filename

        const outputPath = path.resolve(__dirname, `../../downloads/${title}.mp3`);

        const audioStream = ytdl(videoUrl, { 
            quality: "highestaudio", 
            requestOptions: {
                headers: {
                    Cookie: cookies, // Attach the cookies
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", // Mimic a real browser
                }
            }
        });

        ffmpeg(audioStream)
            .audioCodec("libmp3lame")
            .toFormat("mp3")
            .save(outputPath)
            .on("end", () => {
                res.download(outputPath, `${title}.mp3`, () => {
                    fs.unlinkSync(outputPath); // Delete after download
                });
            });
    } catch (error) {
        console.error("Download error:", error);
        res.status(500).json({ error: "Failed to download video" });
    }
});

module.exports = router;
