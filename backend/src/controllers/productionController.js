const pool = require("../config/database");

function isNonNegativeNumber(value) {
    return (
        value !== undefined &&
        value !== null &&
        value !== "" &&
        Number.isFinite(Number(value)) &&
        Number(value) >= 0
    );
}

async function getActor(req) {
    const userId = req.user?.sub || req.user?.id;

    if (!userId) {
        return null;
    }

    const result = await pool.query(
        `
        SELECT
            u.id,
            u.role,
            u.employee_id,
            e.designation
        FROM app_users u
        LEFT JOIN employees e ON e.id = u.employee_id
        WHERE u.id = $1
          AND u.is_active = TRUE
        `,
        [userId]
    );

    if (!result.rowCount) {
        return null;
    }

    const actor = result.rows[0];
const designation = String(actor.designation || "").trim().toLowerCase();

// Only the actual app_users role grants full admin privileges.
actor.isAdmin = actor.role === "admin";

// Supervisor and Admin designations may review and verify production.
actor.isSupervisor =
    actor.isAdmin ||
    designation === "supervisor" ||
    designation === "admin";

return actor;

}

function sendForbidden(res, message = "You are not authorized to perform this action.") {
    return res.status(403).json({
        success: false,
        message,
    });
}

exports.createProductionEntry = async (req, res) => {
    try {
        const actor = await getActor(req);

        if (!actor) {
            return res.status(401).json({
                success: false,
                message: "User account not found or inactive.",
            });
        }

        const {
            employeeId,
            locationId,
            productionDate,
            shift = "General",
            productName,
            targetQuantity = 0,
            actualQuantity,
            acceptedQuantity = 0,
            rejectedQuantity = 0,
            hoursWorked = 0,
            remarks = null,
        } = req.body;

        // Non-admin accounts may submit production only for themselves.
        const finalEmployeeId = actor.isAdmin
            ? employeeId
            : actor.employee_id;

        if (
            !finalEmployeeId ||
            !locationId ||
            typeof productName !== "string" ||
            !productName.trim() ||
            actualQuantity === undefined
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Employee, location, product name, and actual quantity are required.",
            });
        }

        const quantities = {
            targetQuantity,
            actualQuantity,
            acceptedQuantity,
            rejectedQuantity,
            hoursWorked,
        };

        for (const [field, value] of Object.entries(quantities)) {
            if (!isNonNegativeNumber(value)) {
                return res.status(400).json({
                    success: false,
                    message: `${field} must be a valid non-negative number.`,
                });
            }
        }

        if (
            Number(acceptedQuantity) + Number(rejectedQuantity) >
            Number(actualQuantity)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Accepted plus rejected quantity cannot exceed actual quantity.",
            });
        }

        const result = await pool.query(
            `
            INSERT INTO production_entries (
                employee_id,
                location_id,
                production_date,
                shift,
                product_name,
                target_quantity,
                actual_quantity,
                accepted_quantity,
                rejected_quantity,
                hours_worked,
                remarks,
                approval_status,
                submitted_by
            )
            VALUES (
                $1, $2, COALESCE($3::date, CURRENT_DATE),
                $4, $5, $6, $7, $8, $9, $10, $11,
                'pending', $12
            )
            RETURNING *
            `,
            [
                finalEmployeeId,
                locationId,
                productionDate || null,
                shift,
                productName.trim(),
                targetQuantity,
                actualQuantity,
                acceptedQuantity,
                rejectedQuantity,
                hoursWorked,
                remarks,
                actor.id,
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Production entry submitted for verification.",
            entry: result.rows[0],
        });
    } catch (error) {
        console.error("Create production entry failed:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to save production entry.",
        });
    }
};

exports.getProductionEntries = async (req, res) => {
    try {
        const actor = await getActor(req);

        if (!actor) {
            return res.status(401).json({
                success: false,
                message: "User account not found or inactive.",
            });
        }

        const { employeeId, locationId, date, from, to, status } = req.query;
        const conditions = [];
        const values = [];

        // Regular employees see only their own entries.
        // Supervisors and Admins can review entries from all employees.
        if (!actor.isSupervisor) {
            if (!actor.employee_id) {
                return res.status(403).json({
                    success: false,
                    message: "This account is not linked to an employee.",
                });
            }

            values.push(actor.employee_id);
            conditions.push(`p.employee_id = $${values.length}`);
        } else if (actor.isAdmin && employeeId) {
            values.push(employeeId);
            conditions.push(`p.employee_id = $${values.length}`);
        }

        if (locationId) {
            values.push(locationId);
            conditions.push(`p.location_id = $${values.length}`);
        }

        if (date) {
            values.push(date);
            conditions.push(`p.production_date = $${values.length}::date`);
        }

        if (from) {
            values.push(from);
            conditions.push(`p.production_date >= $${values.length}::date`);
        }

        if (to) {
            values.push(to);
            conditions.push(`p.production_date <= $${values.length}::date`);
        }

        if (status && ["pending", "approved", "rejected"].includes(status)) {
            values.push(status);
            conditions.push(`p.approval_status = $${values.length}`);
        }

        const whereClause = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        const result = await pool.query(
            `
            SELECT
                p.*,
                e.employee_code,
                e.full_name,
                e.designation,
                l.name AS location_name,
                verifier.username AS verifier_username
            FROM production_entries p
            JOIN employees e ON e.id = p.employee_id
            JOIN locations l ON l.id = p.location_id
            LEFT JOIN app_users verifier ON verifier.id = p.verified_by
            ${whereClause}
            ORDER BY p.production_date DESC, p.created_at DESC
            `,
            values
        );

        return res.json({
            success: true,
            count: result.rowCount,
            entries: result.rows,
        });
    } catch (error) {
        console.error("Get production entries failed:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch production entries.",
        });
    }
};

exports.verifyProductionEntry = async (req, res) => {
    const { id } = req.params;
    const { status, rejectionReason = null } = req.body;

    if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({
            success: false,
            message: "Status must be approved or rejected.",
        });
    }

    if (
        status === "rejected" &&
        (typeof rejectionReason !== "string" || !rejectionReason.trim())
    ) {
        return res.status(400).json({
            success: false,
            message: "A rejection reason is required.",
        });
    }

    let client;

    try {
        const actor = await getActor(req);

        if (!actor) {
            return res.status(401).json({
                success: false,
                message: "User account not found or inactive.",
            });
        }

        if (!actor.isSupervisor) {
            return sendForbidden(
                res,
                "Only Supervisors or Admins can verify production entries."
            );
        }

        client = await pool.connect();
        await client.query("BEGIN");

        const entryResult = await client.query(
            `
            SELECT id, submitted_by, approval_status
            FROM production_entries
            WHERE id = $1
            FOR UPDATE
            `,
            [id]
        );

        if (!entryResult.rowCount) {
            await client.query("ROLLBACK");
            return res.status(404).json({
                success: false,
                message: "Production entry not found.",
            });
        }

        const entry = entryResult.rows[0];

        if (String(entry.submitted_by) === String(actor.id)) {
            await client.query("ROLLBACK");
            return sendForbidden(res, "You cannot verify your own production entry.");
        }

        if (entry.approval_status !== "pending") {
            await client.query("ROLLBACK");
            return res.status(409).json({
                success: false,
                message: "Only pending production entries can be verified.",
            });
        }

        const result = await client.query(
            `
            UPDATE production_entries
            SET
                approval_status = $1,
                verified_by = $2,
                verified_at = NOW(),
                rejection_reason = $3,
                updated_at = NOW()
            WHERE id = $4
            RETURNING *
            `,
            [
                status,
                actor.id,
                status === "rejected" ? rejectionReason.trim() : null,
                id,
            ]
        );

        await client.query("COMMIT");

        return res.json({
            success: true,
            message: `Production entry ${status}.`,
            entry: result.rows[0],
        });
    } catch (error) {
        if (client) {
            await client.query("ROLLBACK");
        }

        console.error("Verify production entry failed:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to verify production entry.",
        });
    } finally {
        if (client) {
            client.release();
        }
    }
};

exports.updateProductionEntry = async (req, res) => {
    try {
        const actor = await getActor(req);

        if (!actor) {
            return res.status(401).json({
                success: false,
                message: "User account not found or inactive.",
            });
        }

        if (!actor.isAdmin) {
            return sendForbidden(res, "Only Admins can edit production entries.");
        }

        const { id } = req.params;
        const {
            employeeId,
            locationId,
            productionDate,
            shift,
            productName,
            targetQuantity,
            actualQuantity,
            acceptedQuantity,
            rejectedQuantity,
            hoursWorked,
            remarks,
        } = req.body;

        const result = await pool.query(
            `
            UPDATE production_entries
            SET
                employee_id = COALESCE($1, employee_id),
                location_id = COALESCE($2, location_id),
                production_date = COALESCE($3::date, production_date),
                shift = COALESCE($4, shift),
                product_name = COALESCE($5, product_name),
                target_quantity = COALESCE($6, target_quantity),
                actual_quantity = COALESCE($7, actual_quantity),
                accepted_quantity = COALESCE($8, accepted_quantity),
                rejected_quantity = COALESCE($9, rejected_quantity),
                hours_worked = COALESCE($10, hours_worked),
                remarks = COALESCE($11, remarks),
                updated_at = NOW()
            WHERE id = $12
              AND approval_status = 'pending'
            RETURNING *
            `,
            [
                employeeId ?? null,
                locationId ?? null,
                productionDate ?? null,
                shift ?? null,
                productName ?? null,
                targetQuantity ?? null,
                actualQuantity ?? null,
                acceptedQuantity ?? null,
                rejectedQuantity ?? null,
                hoursWorked ?? null,
                remarks ?? null,
                id,
            ]
        );

        if (!result.rowCount) {
            return res.status(404).json({
                success: false,
                message: "Pending production entry not found.",
            });
        }

        return res.json({
            success: true,
            message: "Production entry updated successfully.",
            entry: result.rows[0],
        });
    } catch (error) {
        console.error("Update production entry failed:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to update production entry.",
        });
    }
};

exports.deleteProductionEntry = async (req, res) => {
    try {
        const actor = await getActor(req);

        if (!actor) {
            return res.status(401).json({
                success: false,
                message: "User account not found or inactive.",
            });
        }

        if (!actor.isAdmin) {
            return sendForbidden(res, "Only Admins can delete production entries.");
        }

        const result = await pool.query(
            `
            DELETE FROM production_entries
            WHERE id = $1
              AND approval_status = 'pending'
            RETURNING id
            `,
            [req.params.id]
        );

        if (!result.rowCount) {
            return res.status(404).json({
                success: false,
                message: "Pending production entry not found.",
            });
        }

        return res.json({
            success: true,
            message: "Production entry deleted successfully.",
            deletedId: result.rows[0].id,
        });
    } catch (error) {
        console.error("Delete production entry failed:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to delete production entry.",
        });
    }
};

exports.getProductionLocations = async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT id, name, address
            FROM locations
            WHERE is_active = TRUE
            ORDER BY name
            `
        );

        return res.json({
            success: true,
            locations: result.rows,
        });
    } catch (error) {
        console.error("Get production locations failed:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch locations.",
        });
    }
};
