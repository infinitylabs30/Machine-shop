const pool = require("../config/database");
const bcrypt = require("bcryptjs");

async function getEmployees(req, res) {
    try {
        const result = await pool.query(`
            SELECT
                id,
                employee_code,
                full_name,
                phone,
                is_active,
                face_registered_at,
                (face_embedding IS NOT NULL) AS face_registered,
                created_at
            FROM employees
            ORDER BY full_name ASC
        `);

        return res.json({
            success: true,
            employees: result.rows,
        });
    } catch (error) {
        console.error("Get employees failed:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve employees",
        });
    }
}

async function createEmployee(req, res) {
    const { employeeCode, fullName, phone } = req.body;

    if (
        typeof employeeCode !== "string" ||
        !employeeCode.trim() ||
        typeof fullName !== "string" ||
        !fullName.trim()
    ) {
        return res.status(400).json({
            success: false,
            message: "Employee code and full name are required",
        });
    }

    const normalizedCode = employeeCode.trim().toUpperCase();
    const username = normalizedCode.toLowerCase();
    const initialPassword = `precise@${normalizedCode}`;

    let client;

    try {
        client = await pool.connect();

        await client.query("BEGIN");

        const employeeResult = await client.query(
            `
            INSERT INTO employees (
                employee_code,
                full_name,
                phone
            )
            VALUES ($1, $2, $3)
            RETURNING
                id,
                employee_code,
                full_name,
                phone,
                is_active,
                face_registered_at,
                (face_embedding IS NOT NULL) AS face_registered,
                created_at
            `,
            [
                normalizedCode,
                fullName.trim(),
                typeof phone === "string" ? phone.trim() || null : null,
            ]
        );

        const employee = employeeResult.rows[0];
        const passwordHash = await bcrypt.hash(initialPassword, 12);

        await client.query(
            `
            INSERT INTO app_users (
                username,
                password_hash,
                role,
                employee_id,
                must_change_password
            )
            VALUES ($1, $2, 'employee', $3, TRUE)
            `,
            [username, passwordHash, employee.id]
        );

        await client.query("COMMIT");

        return res.status(201).json({
            success: true,
            message: "Employee and login account created successfully",
            employee,
            credentials: {
                username,
                initialPassword,
                mustChangePassword: true,
            },
        });
    } catch (error) {
        if (client) {
            await client.query("ROLLBACK");
        }

        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message:
                    "This employee ID or login ID already exists. Please use a unique ID.",
            });
        }

        console.error("Create employee failed:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to create employee and login account",
        });
    } finally {
        if (client) {
            client.release();
        }
    }
}

module.exports = {
    getEmployees,
    createEmployee,
};