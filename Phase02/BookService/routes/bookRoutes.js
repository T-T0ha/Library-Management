const express = require('express');
const router = express.Router();
const {
  addBook,
  getBooks,
  getBookById,
  updateBook,
  deleteBook,
  getThePopularBooks,
  updateBookCopy,
  countBooks,
  getAvailableCopies
} = require('../controllers/bookController');

router.post('/', addBook);
router.get('/', getBooks);

router.get('/stats/popularBooks', getThePopularBooks);
router.get('/countbooks',countBooks);
router.get('/availableCopies', getAvailableCopies);
router.get('/:id', getBookById);
router.put('/:id', updateBook);
router.delete('/:id', deleteBook);
router.patch('/:id/update', updateBookCopy);


module.exports = router;