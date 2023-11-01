const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());

app.get('/card/:name/:set', async (req, res) => {
    try {
        const response = await axios.get(`https://api.scryfall.com/cards/named?set=${req.params.set}&fuzzy=${req.params.name}`);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ message: "Card not found" });
    }
});

app.get('/search/:query', async (req, res) => {
    try {
        const response = await axios.get(`https://api.scryfall.com/cards/search?q=${req.params.query}`);
        if (response.data && response.data.data) {
            res.json(response.data.data); // Send the array of cards.
        } else {
            res.json([]);
        }
    } catch (error) {
        res.status(500).json({ message: "Error searching for cards" });
    }
});

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
