const express = require("express");
const ytdl = require("ytdl-core");
const ytdlp = require("yt-dlp-exec");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static"); // Import ffmpeg-static
const path = require("path");
const fs = require("fs");
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();
const app = express();

app.use(
    cors({
        origin: process.env.APP_URL, // Your React frontend
    })
);

app.use(express.json());

const API_KEY = process.env.YOUTUBE_API_KEY;

const authenticateJWT = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];

    try {
        // Call Google API to validate the token
        const response = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
        const data = await response.json();

        if (data.error) {
            return res.status(403).json({ message: "Invalid token", error: data.error });
        }

        req.user = {
            id: data.sub,
            email: data.email,
            name: data.name,
            accessToken: token
        };

        next();
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Error verifying token", error });
    }
};

// ffmpeg.setFfmpegPath(ffmpegStatic);


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


app.get("/download/audio", authenticateJWT, async (req, res) => {



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
    // const videoId = req.query.id; // YouTube video URL from frontend
    // if (!videoId) return res.status(400).json({ error: "No video ID provided" });

    // const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // try {
    //     const info = await ytdl.getInfo(videoUrl, {
    //         requestOptions: {
    //             headers:
    //                 { Authorization: `Bearer ${req.user.accessToken}` }
                    
    //             // Optional. If not given, ytdl-core will try to find it.
    //             // You can find this by going to a video's watch page, viewing the source,
    //             // and searching for "ID_TOKEN".
    //             // 'x-youtube-identity-token': 1324,
    //             ,
    //         }
    //     });
    //     const title = info.videoDetails.title.replace(/[^a-zA-Z0-9]/g, "_"); // Safe filename

    //     const outputPath = path.resolve(__dirname, `downloads/${title}.mp3`);

    //     const audioStream = ytdl(videoUrl, { quality: "highestaudio" });

    //     ffmpeg(audioStream)
    //         .audioCodec("libmp3lame")
    //         .toFormat("mp3")
    //         .save(outputPath)
    //         .on("end", () => {
    //             res.download(outputPath, `${title}.mp3`, () => {
    //                 fs.unlinkSync(outputPath); // Delete after download
    //             });
    //         });
    // } catch (error) {
    //     console.error("Download error:", error);
    //     res.status(500).json({ error: "Failed to download video" });
    // }
});


app.get("/liked-videos", authenticateJWT, async (req, res) => {
    try {
        const response = await fetch("https://www.googleapis.com/youtube/v3/videos?part=snippet&myRating=like", {
            headers: { Authorization: `Bearer ${req.user.accessToken}` }
        });

        const data = await response.json();
        res.json(data.items || []);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch liked videos" });
    }
});

app.get("/playlists", authenticateJWT, async (req, res) => {
    try {
        const response = await fetch("https://www.googleapis.com/youtube/v3/playlists?part=snippet&mine=true", {
            headers: { Authorization: `Bearer ${req.user.accessToken}` }
        });

        const data = await response.json();
        res.json(data.items || []);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch playlists videos" });
    }
});

app.get("/playlists/:id", authenticateJWT, async (req, res) => {
    const id = req.params.id;

    console.log(id);

    try {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${id}&maxResults=50`, {
            headers: { Authorization: `Bearer ${req.user.accessToken}` }
        });

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch playlist " + id });
    }
});

// Fetch video analytics
app.get('/analytics/:videoId', authenticateJWT, async (req, res) => {
    try {
        const videoId = req.params.videoId;
        const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${API_KEY}`);
        const data = await response.json();
        res.json(data.items[0].statistics);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
