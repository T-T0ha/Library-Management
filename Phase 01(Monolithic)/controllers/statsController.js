// const asyncHandler = require('express-async-handler');
// const Book = require('../models/Book');
// const User = require('../models/User');
// const Loan = require('../models/Loan');

// // @desc    Get most borrowed books
// // @route   GET /api/stats/books/popular
// // @access  Public
// const getPopularBooks = asyncHandler(async (req, res) => {
//   const popularBooks = await Loan.aggregate([
//     {
//       $group: {
//         _id: '$book',
//         borrowCount: { $sum: 1 }
//       }
//     },
//     { $sort: { borrowCount: -1 } },
//     { $limit: 10 }
//   ]);

//   const bookIds = popularBooks.map(book => book._id);
//   const books = await Book.find({ _id: { $in: bookIds } });

//   const result = popularBooks.map(book => {
//     const bookInfo = books.find(b => b._id.equals(book._id));
//     return {
//       bookId: book._id,
//       title: bookInfo.title,
//       author: bookInfo.author,
//       borrowCount: book.borrowCount
//     };
//   });

//   res.json(result);
// });

// // @desc    Get most active users
// // @route   GET /api/stats/users/active
// // @access  Public
// const getActiveUsers = asyncHandler(async (req, res) => {
//   const activeUsers = await Loan.aggregate([
//     {
//       $group: {
//         _id: '$user',
//         booksBorrowed: { $sum: 1 },
//         currentBorrows: {
//           $sum: {
//             $cond: [{ $in: ['$status', ['ACTIVE', 'OVERDUE']] }, 1, 0]
//           }
//         }
//       }
//     },
//     { $sort: { booksBorrowed: -1 } },
//     { $limit: 10 }
//   ]);

//   const userIds = activeUsers.map(user => user._id);
//   const users = await User.find({ _id: { $in: userIds } });

//   const result = activeUsers.map(user => {
//     const userInfo = users.find(u => u._id.equals(user._id));
//     return {
//       userId: user._id,
//       name: userInfo.name,
//       booksBorrowed: user.booksBorrowed,
//       currentBorrows: user.currentBorrows
//     };
//   });

//   res.json(result);
// });

// // @desc    Get system overview statistics
// // @route   GET /api/stats/overview
// // @access  Public
// const getSystemOverview = asyncHandler(async (req, res) => {
//   const todayStart = new Date();
//   todayStart.setHours(0, 0, 0, 0);
  
//   const todayEnd = new Date();
//   todayEnd.setHours(23, 59, 59, 999);

//   const [
//     totalBooks,
//     totalUsers,
//     booksAvailable,
//     booksBorrowed,
//     overdueLoans,
//     loansToday,
//     returnsToday
//   ] = await Promise.all([
//     Book.countDocuments(),
//     User.countDocuments(),
//     Book.aggregate([{ $group: { _id: null, total: { $sum: '$availableCopies' } } }]),
//     Loan.countDocuments({ status: { $in: ['ACTIVE', 'OVERDUE'] } }),
//     Loan.countDocuments({ status: 'OVERDUE' }),
//     Loan.countDocuments({ issueDate: { $gte: todayStart, $lte: todayEnd } }),
//     Loan.countDocuments({ returnDate: { $gte: todayStart, $lte: todayEnd } })
//   ]);

//   res.json({
//     totalBooks,
//     totalUsers,
//     booksAvailable: (booksAvailable && booksAvailable[0] && booksAvailable[0].total) || 0,
//     booksBorrowed,
//     overdueLoans,
//     loansToday,
//     returnsToday
//   });
// });

// module.exports = {
//   getPopularBooks,
//   getActiveUsers,
//   getSystemOverview
// };