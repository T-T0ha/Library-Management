// const asyncHandler = require('express-async-handler');
// const Book = require('../models/Book');
// import axios from 'axios';
const asyncHandler = require('express-async-handler');
const Book = require('../models/Book');
const axios = require('axios');
//const LoanController = require('./loanController');

const CircuitBreakerStates = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN'
};


class CircuitBreaker {
  constructor(serviceName, timeout = 5000) {
      this.serviceName = serviceName;
      this.state = CircuitBreakerStates.CLOSED;
      this.failureCount = 0;
      this.failureThreshold = 3;
      this.resetAfter = 30000; // 30 seconds
      this.timeout = timeout;
      this.lastFailureTime = null;
  }

  async execute(requestFn) {
      if (this.state === CircuitBreakerStates.OPEN) {
          if (Date.now() - this.lastFailureTime > this.resetAfter) {
              this.state = CircuitBreakerStates.HALF_OPEN;
          }
          throw new Error(`${this.serviceName} service circuit breaker is ${this.state}`);
          
      }


      try {
          const response = await requestFn();
          if (this.state === CircuitBreakerStates.HALF_OPEN) {
              this.state = CircuitBreakerStates.CLOSED;
              this.failureCount = 0;
          }
          return response;
      } catch (error) {
          this.failureCount++;
          this.lastFailureTime = Date.now();
          
          if (this.failureCount >= this.failureThreshold) {
              this.state = CircuitBreakerStates.OPEN;
          }
          
          throw error;
      }
  }
}

const loanService = new CircuitBreaker('LoanService');


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
    try {
      const response = await loanService.execute(() =>
        axios.get(`http://loan-service:8082/api/loans/${book._id}/active`, { timeout: 5000 })
    );
      
      if (response.data.hasActiveLoans) {
        res.status(400);
        throw new Error(`Cannot delete book with ${response.data.activeLoansCount} active loans`);
      }
  
      await book.remove();
      res.status(204).json({ message: 'Book removed' });
    } catch (error) {
      if (error.response) {
        res.status(error.response.status);
        throw new Error(error.response.data.message || 'Error checking active loans');
      } else if (error.request) {
        res.status(503);
        throw new Error('Loan Service unavailable - cannot verify active loans');
      } else {
        throw error;
      }
    }
  } else {
    res.status(404);
    throw new Error('Book not found');
  }
});

// @desc    Get most borrowed books
// @route   GET /api/books/stats/popularBooks
// @access  Public
const getThePopularBooks = asyncHandler(async (req, res) => {
  // const LoanController = require('./loanController');
  // const popularBooks = await LoanController.getPopularBooks();

  try {
    const response = await loanService.execute(() =>
        axios.get(`http://loan-service:8082/api/loans/popularBooks`, { timeout: 5000 })
    );
    
const popularBooks = response.data;
    console.log('Response from Loan Service:', response.data);
    console.log('Popular Books in Books', popularBooks);
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
 }
catch (error) {
  res.status(error.message.includes('circuit breaker is OPEN') ? 503 : 500).json({
      message: "Error fetching popular books",
      error: error.message
  });
}
});


const countBooks = async (req, res) => {
  //console.log("Counting books...");
  const count = await Book.countDocuments();
  return res.status(200).json({ count: count});
};

const getAvailableCopies = async (req,res) => {
  const result = await Book.aggregate([{ $group: { _id: null, total: { $sum: '$availableCopies' } } }]);
  const totalCopies =(result && result[0] && result[0].total) || 0
  return res.status(200).json({ total_copies: totalCopies });
};


const updateBookCopy = async (req, res) => {
  try {
      const { operation } = req.body;
      console.log("Operation:", operation);
      const book = await Book.findById(req.params.id);
      console.log("Book:", book);
      if (!book) {
          return res.status(404).json({ message: "Book not found" });
      }
      if (operation === "increment") {
        
          book.availableCopies += 1;
      } else if (operation === "decrement") {
          if (book.availableCopies <= 0) {
              return res.status(400).json({ message: "No available copies" });
          }
          book.availableCopies -= 1;
      }
      await book.save();
      res.status(200).json({
          id: book._id,
          available_copies: book.availableCopies,
          updatedAt: book.updatedAt
      });
  } catch (error) {
      res.status(500).json({ message: "Error updating book availability", error: error.message });
  }
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
  getAvailableCopies,
  updateBookCopy
};