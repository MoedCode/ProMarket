const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const path = require("path");
const cookieParser = require("cookie-parser");
const morgan = require("morgan"); // HTTP request logger
const fs = require("fs"); // File system module for logging

const app = express();
const PORT = 5001;

// Base URL for Python backend server
const PYTHON_SERVER_URL = "http://127.0.0.1:5000";

// Create a write stream for logging to a file
const accessLogStream = fs.createWriteStream(path.join(__dirname, "access.log"), {
    flags: "a", // Append mode
});

// Middleware
app.use(
    morgan("combined", {
        stream: accessLogStream, // Log requests to access.log
    })
);
app.use(bodyParser.json());
app.use(cookieParser()); // For cookie handling
app.use(express.static(path.join(__dirname, "public/css"))); // Serve static files
app.set("view engine", "ejs"); // Set EJS as template engine
app.set("views", path.join(__dirname, "views")); // Set views directory
app.use('/public', express.static(path.join(__dirname, 'public')));
// Utility function to format time
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString(); // Customize as needed for desired format
}

// Routes
// Home Page (protected)
app.get("/home", async (req, res) => {
    const token = req.cookies.token; // Retrieve the token from the cookie
    if (!token) {
        return res.redirect("/login"); // Redirect to login if no token
    }

    try {
        // Make request to /api/home using the token
        const response = await axios.get(`${PYTHON_SERVER_URL}/api/home/`, {
            headers: {
                Authorization: `Bearer ${token}`, // Pass the token in Authorization header
            },
        });

        // Check if the response contains task data
        if (response.data && Array.isArray(response.data)) {
            res.render("home", { tasks: response.data });
        } else {
            res.status(500).json({ error: "Invalid response structure from backend." });
        }
    } catch (error) {
        if (error.response?.status === 401) {
            console.log(`Error: ${error.response.data?.error || "Unauthorized"}`);
            return res.redirect("/login"); // Redirect to login on token error
        }

        res.status(error.response?.status || 500).json(error.response?.data || { error: "Server error" });
    }
});

// Register User
app.get("/register", (req, res) => {
    res.render("register");
});

app.post("/api/register/", async (req, res) => {
    try {
        const response = await axios.post(`${PYTHON_SERVER_URL}/api/register/`, req.body);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(error.response?.data || { error: "Server error" });
    }
});

// Login User
app.get("/login", (req, res) => {
    res.render("login");
});

app.post("/api/login/", async (req, res) => {
    try {
        const response = await axios.post(`${PYTHON_SERVER_URL}/api/login/`, req.body);

        if (response.data.token) {
            res.cookie("token", response.data.token, { httpOnly: true }); // Store token in httpOnly cookie
        }

        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(error.response?.data || { error: "Server error" });
    }
});

// Logout User
app.get("/logout", (req, res) => {
    res.clearCookie("token"); // Clear the token cookie
    res.redirect("/login");
});
app.delete("/delete", async (req, res) => {
    const token = req.cookies.token; // Extract user token from cookie
    const taskId = req.body.task_id;

    if (!token || !taskId) {
        return res.status(400).json({ error: "Token or Task ID missing" });
    }

    try {
        // Forward the request to the Python backend
        const response = await axios.post(
            `${PYTHON_SERVER_URL}/api/delete/`,
            { task_id: taskId },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        res.status(response.status).json(response.data); // Respond with Python server response
    } catch (error) {
        res.status(error.response?.status || 500).json(error.response?.data || { error: "Delete failed" });
    }
});
app.put("/update", async (req, res) => {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    console.log('Received token:', token);
    const { lock_for, update_data,  category} = req.body;

    if (!token || !lock_for?.id || !update_data) {
        return res.status(401).json({ error: "Unauthorized: Invalid token or request data" });
    }

    try {
        const response = await axios.post(
            `${PYTHON_SERVER_URL}/api/update/`,
            { lock_for, update_data, category },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error('Error from Python backend:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json(error.response?.data || { error: "Update failed" });
    }
});
// Add Task Endpoint (POST)
app.post("/add/task", async (req, res) => {
    const token = req.cookies.token; // Retrieve the token from the cookie
    if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const { task, kickoff, priority } = req.body;

        // Make the POST request to the Python server to add the task
        const response = await axios.post(`${PYTHON_SERVER_URL}/api/add/`, {
            task,
            kickoff,
            priority
        }, {
            headers: {
                Authorization: `Bearer ${token}`, // Pass the token in Authorization header
            }
        });

        res.status(response.status).json(response.data); // Return the response from Python server
    } catch (error) {
        console.error("Error adding task:", error);
        res.status(error.response?.status || 500).json(error.response?.data || { error: "Server error" });
    }
});


// Start server
app.listen(PORT, () => {
    console.log(`Frontend server running at http://127.0.0.1:${PORT}/`); // Message in terminal
});