const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

// CORS configuration for local development
const corsOptions = {
    origin: 'http://localhost:5000',
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Route for getting a card by name and set
app.get('/card/:name/:set', async (req, res) => {
    try {
        const response = await axios.get(`https://api.scryfall.com/cards/named?set=${req.params.set}&fuzzy=${req.params.name}`);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ message: "Card not found" });
    }
});

// Route for searching cards
app.get('/search/:query', async (req, res) => {
    try {
        const response = await axios.get(`https://api.scryfall.com/cards/search?q=${req.params.query}`);
        res.json(response.data.data || []);
    } catch (error) {
        res.status(500).json({ message: "Error searching for cards" });
    }
});

// Start the server on port 5000
app.listen(5000, () => {
    console.log('Server is running on http://localhost:5000');
});
