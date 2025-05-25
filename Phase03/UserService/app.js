const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
//const routes = require('./routes');
const userRoutes = require('./routes/userRoutes');
//const { errorHandler } = require('./middlewares/errorHandler');

const app = express();

dotenv.config();

app.use(cors());
app.use(express.json());

app.use('/api/users', userRoutes);

//app.use(errorHandler);

module.exports = app; // Export the app