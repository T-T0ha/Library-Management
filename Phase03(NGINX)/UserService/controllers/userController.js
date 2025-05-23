const asyncHandler = require('express-async-handler');
const moment = require('moment');
const User = require('../models/User');
const axios = require('axios');
const { get } = require('mongoose');
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

const LoanService = new CircuitBreaker('LoanService');


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
  try {
    const response = await LoanService.execute(() =>
      axios.get(`http://loan-service:8082/api/loans/stats/activeUsers`, { timeout: 5000 })
    );

    console.log('Active Users Response:', response.data);
    
    // Extract the data array from the response
    const activeUsersData = response.data;
    
    if (!Array.isArray(activeUsersData)) {
      throw new Error('Invalid data format received from loan service');
    }

    const userIds = activeUsersData.map(user => user._id);
    const users = await User.find({ _id: { $in: userIds } });

    const result = activeUsersData.map(user => {
      const userInfo = users.find(u => u._id.equals(user._id));
      return {
        userId: user._id,
        name: userInfo?.name || 'Unknown', // Handle missing users
        booksBorrowed: user.booksBorrowed,
        currentBorrows: user.currentBorrows
      };
    });

    res.json(result);

  } catch (error) {
    console.error('Error in getActiveUsers:', error);
    res.status(error.message.includes('circuit breaker is OPEN') ? 503 : 500).json({
      message: "Error fetching active users",
      error: error.message
    });
  }
});


const getUserById=asyncHandler(async(id)=>{
  const user = await User.findById(id);
    return { status: 200, user };
})

const countUsers = async (req,res) => {
  const count = await User.countDocuments();
    return res.status(200).json({ count: count});
};

// @desc    Get all users
// @route   GET /api/users
// @access  Public
const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find({}).select('-__v');
  res.json(users);
});

module.exports = {
  registerUser,
  getUserProfile,
  getUserById,
  countUsers,
  getActiveUsers,
  getAllUsers
};