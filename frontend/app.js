const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const path = require("path");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = 5001;

// Base URL for Python backend server
const PYTHON_SERVER_URL = "http://127.0.0.1:5000";

// Middleware
app.use(bodyParser.json());
app.use(cookieParser()); // For cookie handling
app.use(express.static(path.join(__dirname, "public/css"))); // Serve static files
app.set("view engine", "ejs"); // Set EJS as template engine
app.set("views", path.join(__dirname, "views")); // Set views directory

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
                Authorization: `Bearer ${token}` // Pass the token in Authorization header
            }
        });

        // Check if the response contains task data
        if (response.data && Array.isArray(response.data)) {
            // Pass the entire task objects (no formatting needed for now)
            res.render("home", { tasks: response.data });
        } else {
            // Handle cases where the response data is missing tasks or is not an array
            res.status(500).json({ error: "Invalid response structure from backend." });
        }
    } catch (error) {
        // Redirect to login page if token is missing or invalid
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

        // Save the token in the cookie upon successful login
        if (response.data.token) {
            res.cookie('token', response.data.token, { httpOnly: true }); // Store token in httpOnly cookie
        }

        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(error.response?.data || { error: "Server error" });
    }
});

// Logout User
app.get("/logout", async (req, res) => {
    try {
        // Retrieve the token from the cookie
        const token = req.cookies.token;
        if (!token) {
            return res.redirect("/login"); // Redirect to login if no token
        }

        // Make a POST request to the Python server with the token in the header
        const response = await axios.post(
            `${PYTHON_SERVER_URL}/api/logout/`,
            {}, // No body required for logout
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );

        // Clear the token cookie on successful logout
        res.clearCookie("token");
        res.redirect("/login"); // Redirect to login page
    } catch (error) {
        console.error("Error logging out:", error.response?.data || error.message);

        // Handle failure, e.g., redirect to login or show an error message
        res.clearCookie("token"); // Clear token cookie even if logout fails
        res.redirect("/login"); // Redirect to login page
    }
});

app.post("/api/delete/", async (req, res) => {
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
app.post("/api/update", async (req, res) => {
    const token = req.cookies.token; // Extract user token from cookie
    const { lock_for, update_data } = req.body;
    console.log(`token ${token} request bdy ${req.body}`);
    if (!token || !lock_for?.id || !update_data) {
        return res.status(400).json({ error: "Invalid update request data" });
    }

    try {
        // Forward the update request to the Python backend
        const response = await axios.post(
            `${PYTHON_SERVER_URL}/api/update/`,
            { lock_for, update_data },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        res.status(response.status).json(response.data); // Respond with Python server response
    } catch (error) {
        res.status(error.response?.status || 500).json(error.response?.data || { error: "Update failed" });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Frontend server running at http://127.0.0.1:${PORT}/`);
});
