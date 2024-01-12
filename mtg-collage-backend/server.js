const serverless = require('serverless-http');
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
      ? 'https://mtgchart.netlify.app/' // Netlify frontend URL
      : 'http://localhost:3000', // Local frontend URL for development
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

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

// Only listen on a port if not running in a serverless environment
// if (!process.env.AWS_LAMBDA_FUNCTION_VERSION) {
//     app.listen(3000, () => console.log('Server is running on http://localhost:3000'));
//   }

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

module.exports.handler = serverless(app);