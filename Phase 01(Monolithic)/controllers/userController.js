const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const { get } = require('mongoose');

// @desc    Register a new user
// @route   POST /api/users
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, role } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  const user = await User.create({
    name,
    email,
    role
  });

  if (user) {
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    });
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
});

// @desc    Get user profile
// @route   GET /api/users/:id
// @access  Public
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

//@desc    Get most active users
// @route   GET /api/users//stats/activeUsers
// @access  Public
const getActiveUsers = asyncHandler(async (req, res) => {
  const LoanController = require('./loanController');

  const activeUsers = await LoanController.getActiveUsersData();

  const userIds = activeUsers.map(user => user._id);
  const users = await User.find({ _id: { $in: userIds } });

  const result = activeUsers.map(user => {
    const userInfo = users.find(u => u._id.equals(user._id));
    return {
      userId: user._id,
      name: userInfo.name,
      booksBorrowed: user.booksBorrowed,
      currentBorrows: user.currentBorrows
    };
  });

  res.json(result);
});



const getUserById=asyncHandler(async(id)=>{
  const user = await User.findById(id);
    return { status: 200, user };
})

const countUsers = async () => {
  return await User.countDocuments();
};

module.exports = {
  registerUser,
  getUserProfile,
  getUserById,
  countUsers,
  getActiveUsers
};