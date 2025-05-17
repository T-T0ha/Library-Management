const express = require('express');
const router = express.Router();
const {
  registerUser,
  getUserProfile,
  getActiveUsers,countUsers
} = require('../controllers/userController');

router.post('/', registerUser);
router.get('/stats/activeUsers', getActiveUsers);
router.get('/countusers', countUsers);
router.get('/:id', getUserProfile);

module.exports = router;