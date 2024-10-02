const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    score: Number,
    attempts: Number,
    time: String,
    quizTimes: [
        {
            startTime: Date,
            endTime: Date,
            duration: Number
        }
    ]
});

module.exports = mongoose.model('User', userSchema);
