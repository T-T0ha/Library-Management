const express = require('express');
const router = express.Router();
const {
  issueBook,
  returnBook,
  getUserLoans,
  getOverdueLoans,
  extendLoan,
  getSystemOverview
} = require('../controllers/loanController');
// router.post('/', (req, res, next) => {
//   console.log('Request Body:', req.body);
//   next();
// }, issueBook);
router.post('/', issueBook);
router.post('/returns', returnBook);
router.get('/overdue', getOverdueLoans);
router.get('/:userId', getUserLoans);

router.put('/:id/extend', extendLoan);
router.get('/stats/overview', getSystemOverview);

module.exports = router;