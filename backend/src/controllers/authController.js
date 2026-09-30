const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/database");

async function login(req, res) {
    try {
        const username =
            typeof req.body.username === "string"
                ? req.body.username.trim().toLowerCase()
                : "";
        const password =
            typeof req.body.password === "string"
                ? req.body.password
                : "";

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required",
            });
        }

        if (!process.env.JWT_SECRET) {
            console.error("JWT_SECRET is not configured");
            return res.status(500).json({
                success: false,
                message: "Authentication is not configured",
            });
        }

        const result = await pool.query(
            `SELECT
                u.id,
                u.username,
                u.password_hash,
                u.role,
                u.employee_id,
                u.is_active,
                e.employee_code,
                e.full_name
             FROM app_users u
             LEFT JOIN employees e ON e.id = u.employee_id
             WHERE u.username = $1
             LIMIT 1`,
            [username]
        );

        const user = result.rows[0];

        if (
            !user ||
            !user.is_active ||
            (user.role === "employee" && !user.employee_id) ||
            !(await bcrypt.compare(password, user.password_hash))
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password",
            });
        }

        const token = jwt.sign(
            {
                sub: String(user.id),
                username: user.username,
                role: user.role,
                employeeId: user.employee_id,
            },
            process.env.JWT_SECRET,
            { expiresIn: "8h" }
        );

        return res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                employeeId: user.employee_id,
                employeeCode: user.employee_code,
                fullName: user.full_name,
            },
        });
    } catch (error) {
        console.error("Login error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Unable to log in",
        });
    }
}

async function getCurrentUser(req, res) {
    try {
        const result = await pool.query(
            `SELECT
                u.id,
                u.username,
                u.role,
                u.employee_id,
                e.employee_code,
                e.full_name
             FROM app_users u
             LEFT JOIN employees e ON e.id = u.employee_id
             WHERE u.id = $1
               AND u.is_active = TRUE
             LIMIT 1`,
            [req.user.sub]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Account is inactive or no longer exists",
            });
        }

        return res.json({
            success: true,
            user: result.rows[0],
        });
    } catch (error) {
        console.error("Current user lookup error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Unable to retrieve account",
        });
    }
}

module.exports = { login, getCurrentUser };
