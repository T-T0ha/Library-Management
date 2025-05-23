const asyncHandler = require('express-async-handler');
const moment = require('moment');
const Loan = require('../models/Loan');
const axios = require('axios');

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

const UserService = new CircuitBreaker('UserService');
const BookService = new CircuitBreaker('BookService');


// @desc    Issue a book to a user
// @route   POST /api/loans
// @access  Public
const issueBook = asyncHandler(async (req, res) => {
  //const BookController = require('./bookController');
  const { userId, bookId, dueDate } = req.body;
  // console.log(req.body);
  try {
    const user= await UserService.execute(() =>
      axios.get(`http://user-service:8083/api/users/${userId}`, { timeout: 5000 })
  );
  //const user = UserController.getUserById(userId);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  
    const book= await BookService.execute(() =>
        axios.get(`http://book-service:8081/api/books/${bookId}`, { timeout: 5000 })
    );
  //const book = BookController.getBook(bookId);
  if (book.availableCopies <= 0) {
    res.status(400);
    throw new Error('No available copies of this book');
  }
  // Check if user already has this book on loan
  const existingLoan = await Loan.findOne({
    user: userId,
    book: bookId,
    status: { $in: ['ACTIVE', 'OVERDUE'] }
  });

  if (existingLoan) {
    res.status(400);
    throw new Error('User already has this book on loan');
  }

  const loan = await Loan.create({
    user: userId,
    book: bookId,
    dueDate,
    originalDueDate: dueDate
  });

  await BookService.execute(() =>
    axios.patch(`http://book-service:8081/api/books/${bookId}/update`, {
        operation: "decrement"
    }, { timeout: 5000 })
);

  const populatedLoan = await Loan.findById(loan._id);

  res.status(201).json({
    id: populatedLoan._id,
    user: populatedLoan.user,
    book: populatedLoan.book,
    issueDate: populatedLoan.issueDate,
    dueDate: populatedLoan.dueDate,
    status: populatedLoan.status
  });
} catch (error) {
  res.status(error.message.includes('circuit breaker is OPEN') ? 503 : 500).json({
      message: "Error issuing book",
      error: error.message
  });
}
});

// @desc    Return a book
// @route   POST /api/returns
// @access  Public
const returnBook = asyncHandler(async (req, res) => {
  const { loanId } = req.body;

  const loan = await Loan.findById(loanId)

  if (!loan) {
    res.status(404);
    throw new Error('Loan not found');
  }

  if (loan.status === 'RETURNED') {
    res.status(400);
    throw new Error('Book already returned');
  }

  loan.returnDate = new Date();
  loan.status = 'RETURNED';
  await loan.save();

  await BookService.execute(() =>
    axios.patch(`http://book-service:8081/api/books/${loan.book._id}/update`, {
        operation: "increment"
    }, { timeout: 5000 })
);

  res.json({
    id: loan._id,
    user: {id : loan.user._id},
    book: {
      id: loan.book._id,
      // title: loan.book.title,
      // author: loan.book.author
    },
    issueDate: loan.issueDate,
    dueDate: loan.dueDate,
    returnDate: loan.returnDate,
    status: loan.status
  });
});

// @desc    Get loan history for a user
// @route   GET /api/loans/:userId
// @access  Public
const getUserLoans = asyncHandler(async (req, res) => {
  const loans = await Loan.find({ user: req.params.userId })
    .sort({ issueDate: -1 });

  res.json(loans.map(loan => ({
    id: loan._id,
    book: {
      id: loan.book._id,
      title: loan.book.title,
      author: loan.book.author
    },
    issueDate: loan.issueDate,
    dueDate: loan.dueDate,
    returnDate: loan.returnDate,
    status: loan.status
  })));
});

// @desc    Get all overdue loans
// @route   GET /api/loans/overdue
// @access  Public
const getOverdueLoans = asyncHandler(async (req, res) => {
  const overdueLoans = await Loan.find({
    dueDate: { $lt: new Date() },
    status: { $in: ['ACTIVE', 'OVERDUE'] }
  })
    .populate('user', 'name email')
    .populate('book', 'title author');

  res.json(overdueLoans.map(loan => ({
    id: loan._id,
    user: {
      id: loan.user._id,
      name: loan.user.name,
      email: loan.user.email
    },
    book: {
      id: loan.book._id,
      title: loan.book.title,
      author: loan.book.author
    },
    issueDate: loan.issueDate,
    dueDate: loan.dueDate,
    daysOverdue: moment().diff(moment(loan.dueDate), 'days')
  })));
});

// @desc    Extend a loan
// @route   PUT /api/loans/:id/extend
// @access  Public
const extendLoan = asyncHandler(async (req, res) => {
  const { extensionDays } = req.body;
  const loan = await Loan.findById(req.params.id)
    // .populate('user', 'name email')
    // .populate('book', 'title author');

  if (!loan) {
    res.status(404);
    throw new Error('Loan not found');
  }

  if (loan.status !== 'ACTIVE') {
    res.status(400);
    throw new Error('Only active loans can be extended');
  }

  if (loan.extensionsCount >= 2) {
    res.status(400);
    throw new Error('Maximum extensions reached');
  }

  const newDueDate = moment(loan.dueDate).add(extensionDays, 'days').toDate();
  loan.dueDate = newDueDate;
  loan.extensionsCount += 1;
  await loan.save();

  res.json({
    id: loan._id,
    user: loan.user,
    book: loan.book,
    issueDate: loan.issueDate,
    originalDueDate: loan.originalDueDate,
    extendedDueDate: loan.dueDate,
    status: loan.status,
    extensionsCount: loan.extensionsCount
  });
});

const getPopularBooks = asyncHandler(async (req, res) => {
  console.log('Fetching popular books...');
  try {
    const popularBooks = await Loan.aggregate([
      {
        $group: {
          _id: '$book',
          borrowCount: { $sum: 1 }
        }
      },
      { $sort: { borrowCount: -1 } },
      { $limit: 10 }
    ]);

    console.log('Popular Books:', popularBooks);
    
    if (!popularBooks || popularBooks.length === 0) {
      return res.status(404).json({ 
        message: 'No popular books found' 
      });
    }

    return res.status(200).json(popularBooks);
  } catch (error) {
    console.error('Error in getPopularBooks:', error);
    return res.status(500).json({ 
      message: 'Error fetching popular books',
      error: error.message 
    });
  }
});


// @desc    Get system overview statistics
// @route   GET /api/loans/stats/overview
// @access  Public
const getSystemOverview = asyncHandler(async (req, res) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  try {
    const [
      totalBooksRes,
      totalUsersRes,
      booksAvailableRes,
      booksBorrowed,
      overdueLoans,
      loansToday,
      returnsToday
    ] = await Promise.all([
      BookService.execute(() => 
        axios.get('http://book-service:8081/api/books/countBooks', { timeout: 5000 })
      ),
      UserService.execute(() =>
        axios.get('http://user-service:8083/api/users/countUsers', { timeout: 5000 })
      ),
      BookService.execute(() =>
        axios.get('http://book-service:8081/api/books/availableCopies', { timeout: 5000 })
      ),
      Loan.countDocuments({ status: { $in: ['ACTIVE', 'OVERDUE'] } }),
      Loan.countDocuments({ status: 'OVERDUE' }),
      Loan.countDocuments({ issueDate: { $gte: todayStart, $lte: todayEnd } }),
      Loan.countDocuments({ returnDate: { $gte: todayStart, $lte: todayEnd } })
    ]);

    // Extract data from service responses
    const totalBooks = totalBooksRes?.data || 0;
    const totalUsers = totalUsersRes?.data || 0;
    const booksAvailable = booksAvailableRes?.data || 0;

    res.json({
      
        totalBooks,
        totalUsers,
        booksAvailable,
        booksBorrowed,
        overdueLoans,
        loansToday,
        returnsToday
     
    });
  } catch (error) {
    res.status(error.message.includes('circuit breaker is OPEN') ? 503 : 500).json({
        message: "Error fetching system overview",
        error: error.message
    });
  }
});


const getActiveUsersData = async (req,res) => {
  const activeUsers = await Loan.aggregate([
    {
      $group: {
        _id: '$user',
        booksBorrowed: { $sum: 1 },
        currentBorrows: {
          $sum: {
            $cond: [{ $in: ['$status', ['ACTIVE', 'OVERDUE']] }, 1, 0]
          }
        }
      }
    },
    { $sort: { booksBorrowed: -1 } },
    { $limit: 10 }
  ]);
console.log('Active Users:', activeUsers);
  return res.status(200).json(activeUsers);
};

// @desc    Check if book has active loans
// @route   GET /api/loans/book/:bookId/active
// @access  Public
const checkActiveLoansForBook = asyncHandler(async (req, res) => {
  const activeLoansCount = await Loan.countDocuments({ 
    book: req.params.bookId, 
    status: { $in: ['ACTIVE', 'OVERDUE'] } 
  });

  res.json({
    bookId: req.params.bookId,
    hasActiveLoans: activeLoansCount > 0,
    activeLoansCount
  });
});


module.exports = {
  issueBook,
  returnBook,
  getUserLoans,
  getOverdueLoans,
  extendLoan,
  getPopularBooks,
  getSystemOverview,
  getActiveUsersData,
  checkActiveLoansForBook
};