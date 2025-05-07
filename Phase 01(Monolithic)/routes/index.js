const express = require('express');
const router = express.Router();
const userRoutes = require('./userRoutes');
const bookRoutes = require('./bookRoutes');
const loanRoutes = require('./loanRoutes');
//const statsRoutes = require('./statsRoutes');

router.use('/users', userRoutes);
router.use('/books', bookRoutes);
router.use('/loans', loanRoutes);
//router.use('/stats', statsRoutes);

module.exports = router;