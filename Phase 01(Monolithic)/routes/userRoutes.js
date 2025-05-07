const express = require('express');
const router = express.Router();
const {
  registerUser,
  getUserProfile,
  getActiveUsers
} = require('../controllers/userController');

router.post('/', registerUser);
router.get('/:id', getUserProfile);
router.get('/stats/activeUsers', getActiveUsers);

module.exports = router;