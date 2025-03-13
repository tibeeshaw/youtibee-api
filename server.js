const session = require("express-session");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const express = require('express');
const cors = require('cors');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const dotenv = require('dotenv');

dotenv.config();
const app = express();

app.use(
    cors({
        origin: process.env.APP_URL, // Your React frontend
        credentials: true, // Allow cookies to be sent
    })
);

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        collectionName: "sessions",
    }),
    cookie: {
        secure: false, // Set to true in production with HTTPS
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days session expiration
    }
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/callback",
    scope: ['https://www.googleapis.com/auth/youtube.readonly']
}, (accessToken, refreshToken, profile, done) => {
    return done(null, { profile, accessToken });
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// OAuth Routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'https://www.googleapis.com/auth/youtube.readonly'] }));

app.get('/auth/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
    // res.redirect('/dashboard'); // Redirect after login
    res.redirect(process.env.APP_URL); // Redirect to React frontend
});

app.get('/logout', (req, res) => {
    req.logout(() => res.redirect('/'));
});

app.get('/dashboard', (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    res.json({ message: "You are logged in", user: req.user });
});

app.get("/me", (req, res) => {
    if (req.user) {
        res.json(req.user);
    } else {
        res.status(401).json({ message: "Not authenticated" });
    }
});


app.use(express.json());

const API_KEY = process.env.YOUTUBE_API_KEY;
const channels = {}

app.get('/my-channel', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const response = await fetch('https://www.googleapis.com/youtube/v3/channels?part=id&mine=true', {
            headers: { Authorization: `Bearer ${req.user.accessToken}` }
        });

        const data = await response.json();
        if (data.items && data.items.length > 0) {
            const channelId = data.items[0].id;
            channels[req.user.id] = channelId;
            res.json({ channelId });
        } else {
            res.status(404).json({ error: 'Channel not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch channel ID' });
    }
});

app.get("/liked-videos", async (req, res) => {
    if (!req.user || !req.user.accessToken) {
        return res.status(401).json({ error: "Unauthorized" });
    }

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

app.get("/playlists", async (req, res) => {
    if (!req.user || !req.user.accessToken) {
        return res.status(401).json({ error: "Unauthorized" });
    }

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

app.get("/playlists/:id", async (req, res) => {
    if (!req.user || !req.user.accessToken) {
        return res.status(401).json({ error: "Unauthorized" });
    }

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
app.get('/analytics/:videoId', async (req, res) => {
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
