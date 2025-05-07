const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const routes = require('./routes');
const { errorHandler } = require('./middlewares/errorHandler');

const app = express();

dotenv.config();

app.use(cors());
app.use(express.json());

app.use('/api', routes);

app.use(errorHandler);

module.exports = app; // Export the app