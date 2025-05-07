const express = require('express');
const router = express.Router();
const {
  addBook,
  getBooks,
  getBookById,
  updateBook,
  deleteBook,
  getThePopularBooks,
} = require('../controllers/bookController');

router.post('/', addBook);
router.get('/', getBooks);
router.get('/:id', getBookById);
router.put('/:id', updateBook);
router.delete('/:id', deleteBook);
router.get('/stats/popularBooks', getThePopularBooks);

module.exports = router;