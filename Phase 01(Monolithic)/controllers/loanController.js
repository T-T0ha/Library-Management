const asyncHandler = require('express-async-handler');
const moment = require('moment');
const Loan = require('../models/Loan');
const UserController = require('./userController');

// @desc    Issue a book to a user
// @route   POST /api/loans
// @access  Public
const issueBook = asyncHandler(async (req, res) => {
  const BookController = require('./bookController');
  const { userId, bookId, dueDate } = req.body;
  // console.log(req.body);
  const user = UserController.getUserById(userId);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  const book = BookController.getBook(bookId);
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

  // Decrease available copies
  book.availableCopies -= 1;
  await book.save();

  const populatedLoan = await Loan.findById(loan._id)
    .populate('user', 'id')
    .populate('book', 'id');

  res.status(201).json({
    id: populatedLoan._id,
    user: populatedLoan.user,
    book: populatedLoan.book,
    issueDate: populatedLoan.issueDate,
    dueDate: populatedLoan.dueDate,
    status: populatedLoan.status
  });
});

// @desc    Return a book
// @route   POST /api/returns
// @access  Public
const returnBook = asyncHandler(async (req, res) => {
  const { loanId } = req.body;

  const loan = await Loan.findById(loanId)
    .populate('book')
    .populate('user', 'name email');

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

  // Increase available copies
  const book = BookController.getBook(loan.book._id);
  book.availableCopies += 1;
  await book.save();

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
    .populate('book', 'title author')
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
    .populate('user', 'name email')
    .populate('book', 'title author');

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

const getPopularBooks=asyncHandler(async () => {
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
  return popularBooks;
});

// @desc    Get system overview statistics
// @route   GET /api/loans/stats/overview'
// @access  Public
const getSystemOverview = asyncHandler(async (req, res) => {
  const BookController = require('./bookController');
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [
    totalBooks,
    totalUsers,
    booksAvailable,
    booksBorrowed,
    overdueLoans,
    loansToday,
    returnsToday
  ] = await Promise.all([
    BookController.countBooks(),
    UserController.countUsers(),
    BookController.getAvailableCopies(),
    //Book.aggregate([{ $group: { _id: null, total: { $sum: '$availableCopies' } } }]),
    Loan.countDocuments({ status: { $in: ['ACTIVE', 'OVERDUE'] } }),
    Loan.countDocuments({ status: 'OVERDUE' }),
    Loan.countDocuments({ issueDate: { $gte: todayStart, $lte: todayEnd } }),
    Loan.countDocuments({ returnDate: { $gte: todayStart, $lte: todayEnd } })
  ]);

  res.json({
    totalBooks,
    totalUsers,
    booksAvailable: (booksAvailable && booksAvailable[0] && booksAvailable[0].total) || 0,
    booksBorrowed,
    overdueLoans,
    loansToday,
    returnsToday
  });
});


const getActiveUsersData = async () => {
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

  return activeUsers;
};

module.exports = {
  issueBook,
  returnBook,
  getUserLoans,
  getOverdueLoans,
  extendLoan,
  getPopularBooks,
  getSystemOverview,
  getActiveUsersData
};