const mongoose = require('mongoose');
const moment = require('moment');

const loanSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  book: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true
  },
  issueDate: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: true
  },
  returnDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'RETURNED', 'OVERDUE'],
    default: 'ACTIVE'
  },
  extensionsCount: {
    type: Number,
    default: 0
  },
  originalDueDate: {
    type: Date
  }
});

loanSchema.pre('save', function(next) {
  if (this.isNew) {
    this.originalDueDate = this.dueDate;
  }
  
  if (this.status === 'ACTIVE' && this.dueDate < new Date()) {
    this.status = 'OVERDUE';
  }
  
  next();
});

module.exports = mongoose.model('Loan', loanSchema);