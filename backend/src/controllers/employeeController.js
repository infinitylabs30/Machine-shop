const pool = require("../config/database");

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
        console.error("Get employees error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve employees",
        });
    }
}

async function createEmployee(req, res) {
    try {
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

        const result = await pool.query(
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
                employeeCode.trim().toUpperCase(),
                fullName.trim(),
                phone?.trim() || null,
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Employee added successfully",
            employee: result.rows[0],
        });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "An employee with this code already exists",
            });
        }

        console.error("Create employee error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to add employee",
        });
    }
}

module.exports = {
    getEmployees,
    createEmployee,
};
