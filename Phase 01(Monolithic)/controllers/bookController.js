const asyncHandler = require('express-async-handler');
const Book = require('../models/Book');
const LoanController = require('./loanController');
// @desc    Add a new book
// @route   POST /api/books
// @access  Public
const addBook = asyncHandler(async (req, res) => {
  const { title, author, isbn, copies, genre } = req.body;

  const bookExists = await Book.findOne({ isbn });
  if (bookExists) {
    res.status(400);
    throw new Error('Book already exists');
  }

  const book = await Book.create({
    title,
    author,
    isbn,
    copies,
    availableCopies: copies,
    genre
  });

  if (book) {
    res.status(201).json({
      _id: book._id,
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      copies: book.copies,
      availableCopies: book.availableCopies,
      genre: book.genre,
      createdAt: book.createdAt
    });
  } else {
    res.status(400);
    throw new Error('Invalid book data');
  }
});

// @desc    Get all books or search books
// @route   GET /api/books
// @access  Public
const getBooks = asyncHandler(async (req, res) => {
  const { search } = req.query;
  let query = {};

  if (search) {
    query = {
      $or: [
        { title: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } },
        { genre: { $regex: search, $options: 'i' } }
      ]
    };
  }

  const books = await Book.find(query);
  res.json(books);
});

// @desc    Get book by ID
// @route   GET /api/books/:id
// @access  Public
const getBookById = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);

  if (book) {
    res.json({
      _id: book._id,
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      copies: book.copies,
      availableCopies: book.availableCopies,
      genre: book.genre,
      createdAt: book.createdAt,
      updatedAt: book.updatedAt
    });
  } else {
    res.status(404);
    throw new Error('Book not found');
  }
});


const getBook = asyncHandler(async (id) => {
  const book = await Book.findById(id);

  return book;
});


// @desc    Update book
// @route   PUT /api/books/:id
// @access  Public
const updateBook = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);

  if (book) {
    book.title = req.body.title || book.title;
    book.author = req.body.author || book.author;
    book.isbn = req.body.isbn || book.isbn;
    book.genre = req.body.genre || book.genre;
    
    // Handle copies and availableCopies carefully
    if (req.body.copies !== undefined) {
      //const diff = req.body.copies - book.copies;
      book.copies = req.body.copies;
      //book.availableCopies += diff;
      book.availableCopies=req.body.available_copies;
    }

    const updatedBook = await book.save();

    res.json({
      _id: updatedBook._id,
      title: updatedBook.title,
      author: updatedBook.author,
      isbn: updatedBook.isbn,
      copies: updatedBook.copies,
      availableCopies: updatedBook.availableCopies,
      genre: updatedBook.genre,
      createdAt: updatedBook.createdAt,
      updatedAt: updatedBook.updatedAt
    });
  } else {
    res.status(404);
    throw new Error('Book not found');
  }
});

// @desc    Delete a book
// @route   DELETE /api/books/:id
// @access  Public
const deleteBook = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);

  if (book) {
    // Check if there are any active loans for this book
    // const activeLoans = await Loan.countDocuments({ 
    //   book: book._id, 
    //   status: { $in: ['ACTIVE', 'OVERDUE'] } 
    // });

    // if (activeLoans > 0) {
    //   res.status(400);
    //   throw new Error('Cannot delete book with active loans');
    // }

    await book.remove();
    res.status(204).json({ message: 'Book removed' });
  } else {
    res.status(404);
    throw new Error('Book not found');
  }
});

// @desc    Get most borrowed books
// @route   GET /api/books/stats/popularBooks
// @access  Public
const getThePopularBooks = asyncHandler(async (req, res) => {
  const LoanController = require('./loanController');
  const popularBooks = await LoanController.getPopularBooks();
  //console.log('Popular Books', popularBooks);
  if (!popularBooks) {
    res.status(404);
    throw new Error('No popular books found');
  }

  const bookIds = popularBooks.map(book => book._id);
  //console.log('Book IDs:', bookIds);
  const books = await Book.find({ _id: { $in: bookIds } });

  const result = popularBooks.map(book => {
    const bookInfo = books.find(b => b._id.equals(book._id));
    return {
      bookId: book._id,
      title: bookInfo.title,
      author: bookInfo.author,
      borrowCount: book.borrowCount
    };
  });

  res.json(result);
});





const countBooks = async () => {
  return await Book.countDocuments();
};

const getAvailableCopies = async () => {
  const result = await Book.aggregate([{ $group: { _id: null, total: { $sum: '$availableCopies' } } }]);
  return (result && result[0] && result[0].total) || 0;
};



module.exports = {
  addBook,
  getBooks,
  getBookById,
  updateBook,
  deleteBook,
  getBook,
  getThePopularBooks,
  countBooks,
  getAvailableCopies
};