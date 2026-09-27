const pool = require("../config/database");
const { registerFace, verifyFace } = require("../services/faceService");

async function registerEmployeeFace(req, res) {
    try {
        const { employeeCode, faceImage } = req.body;

        if (!employeeCode || !faceImage) {
            return res.status(400).json({
                success: false,
                message: "employeeCode and faceImage are required",
            });
        }

        const employeeResult = await pool.query(
            `
            SELECT id, employee_code, full_name
            FROM employees
            WHERE employee_code = $1
              AND is_active = TRUE
            `,
            [employeeCode]
        );

        if (employeeResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Employee not found",
            });
        }

        const employee = employeeResult.rows[0];

        const faceResult = await registerFace(faceImage);

        if (!faceResult.success) {
            return res.status(400).json({
                success: false,
                message: faceResult.message || "Face registration failed",
            });
        }

        await pool.query(
            `
            UPDATE employees
            SET
                face_embedding = $1::jsonb,
                face_registered_at = NOW(),
                updated_at = NOW()
            WHERE id = $2
            `,
            [JSON.stringify(faceResult.embedding), employee.id]
        );

        return res.json({
            success: true,
            message: "Face registered successfully",
            employee: {
                id: employee.id,
                employeeCode: employee.employee_code,
                fullName: employee.full_name,
            },
        });
    } catch (error) {
        console.error("Face registration error:", error);

        return res.status(500).json({
            success: false,
            message: "Face registration failed",
            error: error.message,
        });
    }
}

async function verifyEmployeeFace(req, res) {
    try {
        const { employeeCode, faceImage } = req.body;

        if (!employeeCode || !faceImage) {
            return res.status(400).json({
                success: false,
                message: "employeeCode and faceImage are required",
            });
        }

        const employeeResult = await pool.query(
            `
            SELECT id, employee_code, full_name, face_embedding
            FROM employees
            WHERE employee_code = $1
              AND is_active = TRUE
            `,
            [employeeCode]
        );

        if (employeeResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Employee not found",
            });
        }

        const employee = employeeResult.rows[0];

        if (!employee.face_embedding) {
            return res.status(400).json({
                success: false,
                message: "Face is not registered for this employee",
            });
        }

        const faceResult = await verifyFace(
            faceImage,
            employee.face_embedding
        );

        return res.json({
            success: true,
            verified: faceResult.verified,
            similarity: faceResult.similarity,
            threshold: faceResult.threshold,
            employee: {
                employeeCode: employee.employee_code,
                fullName: employee.full_name,
            },
        });
    } catch (error) {
        console.error("Face verification error:", error);

        return res.status(500).json({
            success: false,
            message: "Face verification failed",
            error: error.message,
        });
    }
}

module.exports = {
    registerEmployeeFace,
    verifyEmployeeFace,
};
