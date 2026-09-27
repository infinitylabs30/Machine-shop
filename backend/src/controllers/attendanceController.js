const pool = require("../config/database");
const { findValidLocation } = require("../services/locationService");
const { verifyFace } = require("../services/faceService");

async function markAttendance(req, res) {
    try {
        const {
            employeeCode,
            eventType,
            latitude,
            longitude,
            deviceInfo,
            faceImage,
        } = req.body;

        // Validate required input
        if (!employeeCode || typeof employeeCode !== "string") {
            return res.status(400).json({
                success: false,
                message: "Employee code is required",
            });
        }

        if (!["ENTRY", "EXIT"].includes(eventType)) {
            return res.status(400).json({
                success: false,
                message: "Event type must be ENTRY or EXIT",
            });
        }

        if (
            typeof latitude !== "number" ||
            typeof longitude !== "number" ||
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid latitude and longitude are required",
            });
        }

        if (!faceImage || typeof faceImage !== "string") {
            return res.status(400).json({
                success: false,
                message: "Face image is required for attendance verification",
            });
        }

        // Find active employee and registered face template
        const employeeResult = await pool.query(
            `
            SELECT
                id,
                employee_code,
                full_name,
                face_embedding
            FROM employees
            WHERE employee_code = $1
              AND is_active = TRUE
            `,
            [employeeCode.trim()]
        );

        if (employeeResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Employee not found or inactive",
            });
        }

        const employee = employeeResult.rows[0];

        if (!employee.face_embedding) {
            return res.status(400).json({
                success: false,
                message: "Face is not registered for this employee",
            });
        }

        // Verify company geofence
        const locationResult = await findValidLocation(
            latitude,
            longitude
        );

        if (!locationResult.valid) {
            return res.status(403).json({
                success: false,
                message:
                    "You are outside the permitted company attendance location",
            });
        }

        // Prevent duplicate consecutive events
        const lastEventResult = await pool.query(
            `
            SELECT event_type, event_time
            FROM attendance_events
            WHERE employee_id = $1
            ORDER BY event_time DESC, id DESC
            LIMIT 1
            `,
            [employee.id]
        );

        if (lastEventResult.rows.length > 0) {
            const lastEvent = lastEventResult.rows[0];

            if (lastEvent.event_type === eventType) {
                return res.status(409).json({
                    success: false,
                    message: `Last attendance event is already ${eventType}`,
                    lastEventTime: lastEvent.event_time,
                });
            }
        }

        // Verify live face against the employee's registered embedding
        const faceResult = await verifyFace(
            faceImage,
            employee.face_embedding
        );

        if (!faceResult.success) {
            return res.status(400).json({
                success: false,
                message: faceResult.message || "Face verification could not be completed",
            });
        }

        if (faceResult.verified !== true) {
            return res.status(403).json({
                success: false,
                verified: false,
                similarity: faceResult.similarity,
                threshold: faceResult.threshold,
                message: "Face does not match the registered employee",
            });
        }

        // Record attendance only after successful face verification
        const insertResult = await pool.query(
            `
            INSERT INTO attendance_events (
                employee_id,
                event_type,
                location_id,
                latitude,
                longitude,
                distance_meters,
                face_verified,
                face_similarity,
                device_info
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, event_time
            `,
            [
                employee.id,
                eventType,
                locationResult.location.id,
                latitude,
                longitude,
                locationResult.distance,
                true,
                faceResult.similarity,
                deviceInfo || null,
            ]
        );

        return res.status(201).json({
            success: true,
            verified: true,
            similarity: faceResult.similarity,
            threshold: faceResult.threshold,
            message: `${eventType} recorded successfully`,
            location: locationResult.location.name,
            distanceMeters: locationResult.distance,
            attendance: {
                id: insertResult.rows[0].id,
                employeeCode: employee.employee_code,
                employeeName: employee.full_name,
                eventType,
                location: locationResult.location.name,
                distanceMeters: locationResult.distance,
                eventTime: insertResult.rows[0].event_time,
                faceVerified: true,
                faceSimilarity: faceResult.similarity,
            },
        });
    } catch (error) {
    console.error("========== ATTENDANCE ERROR ==========");
    console.error("Message:", error.message);
    console.error("Code:", error.code);
    console.error("Detail:", error.detail);
    console.error("Stack:", error.stack);
    console.error("======================================");

    return res.status(500).json({
        success: false,
        message: "Failed to record attendance",
        error: error.message,
        code: error.code || null,
    });
 }
}

module.exports = {
    markAttendance,
};
