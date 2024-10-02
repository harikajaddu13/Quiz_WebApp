const express = require('express');
const path = require('path');
const session = require('express-session');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const User = require('./models/User'); // Assuming you have a User model in './models/User'
const fileUpload = require('express-fileupload');
const xlsx = require('xlsx');
const fs = require('fs');

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({
    secret: 'your_secret_key',
    resave: true,
    saveUninitialized: true
}));
app.use(fileUpload());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/user_auth', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Routes
// Display login page
app.get('/', (req, res) => {
    if (req.session.user) {
        res.redirect('/home');
    } else {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    }
});

// Handle login form submission
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username: username });

        if (user && await bcrypt.compare(password, user.password)) {
            req.session.user = user;
            res.redirect('/home');
        } else {
            res.send('Invalid username or password');
        }
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Display home page
app.get('/home', (req, res) => {
    if (req.session.user) {
        res.sendFile(path.join(__dirname, 'public', 'home.html'));
    } else {
        res.redirect('/login');
    }
});

// Display registration page
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Handle registration form submission

app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    try {
        const existingUser = await User.findOne({ username: username });
        if (existingUser) {
            return res.send('Username already exists');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            username: username,
            password: hashedPassword
        });

        await newUser.save();

        res.redirect('/login'); // Redirect to login page after successful registration
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Define the login route explicitly
app.get('/login', (req, res) => {
    if (req.session.user) {
        res.redirect('/home');
    } else {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    }
});
// Handle quiz end
app.post('/endQuiz', async (req, res) => {
    const { score, startTime, currentQuestionIndex } = req.body;

    if (!req.session.user) {
        return res.status(401).send('User not authenticated');
    }

    const endTime = new Date();
    const elapsedTime = (endTime - new Date(startTime)) / 1000; // Time in seconds

    try {
        const updatedUser = await User.findOneAndUpdate(
            { username: req.session.user.username },
            {
                $set: {
                    score: score,
                    time: `${elapsedTime} seconds`
                },
                $inc: { attempts: 1 },
                $push: { quizTimes: { startTime: startTime, endTime: endTime, duration: elapsedTime } } // Add new quiz attempt
            },
            { new: true }
        );

        if (!updatedUser) {
            console.error('User not found');
            return res.status(404).send('User not found');
        }

        console.log('User updated:', updatedUser);
        res.redirect('/final.html');
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).send('Error updating user');
    }
});




// Upload Route with Validation and JSON Conversion
app.post('/upload', (req, res) => {
    if (!req.files || !req.files.file) {
        return res.status(400).send('No file uploaded');
    }

    const file = req.files.file;

    if (file.mimetype !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' &&
        file.mimetype !== 'application/vnd.ms-excel') {
        return res.status(400).send('Unsupported file type');
    }

    const uploadPath = path.join(__dirname, 'uploads', file.name);

    try {
        file.mv(uploadPath, async (err) => {
            if (err) {
                return res.status(500).send(err);
            }

            const workbook = xlsx.readFile(uploadPath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(worksheet);

            const transformedData = data.map(item => {
                return {
                    question: item.question,
                    correct_answer: item.correct_answer,
                    incorrect_answers: [
                        item.incorrect_answers__001,
                        item.incorrect_answers__002,
                        item.incorrect_answers__003
                    ]
                };
            });

            const jsonPath = path.join(__dirname, 'public', 'uploadedQuestions.json');
            fs.writeFileSync(jsonPath, JSON.stringify({ results: transformedData }));

            res.send('File uploaded and converted to JSON successfully');
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('An error occurred');
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
