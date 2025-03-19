const express = require("express");
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

        console.log(token);

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
