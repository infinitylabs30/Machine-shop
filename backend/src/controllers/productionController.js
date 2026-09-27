const pool = require("../config/database");

const allowedFields = [
    "employeeId",
    "locationId",
    "productionDate",
    "shift",
    "productName",
    "targetQuantity",
    "actualQuantity",
    "acceptedQuantity",
    "rejectedQuantity",
    "hoursWorked",
    "remarks",
];

function isNonNegativeNumber(value) {
    return value !== undefined &&
        value !== null &&
        value !== "" &&
        Number.isFinite(Number(value)) &&
        Number(value) >= 0;
}

exports.createProductionEntry = async (req, res) => {
    try {
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

        if (!employeeId || !locationId || !productName ||
            actualQuantity === undefined) {
            return res.status(400).json({
                success: false,
                message: "Employee, location, product name, and actual quantity are required.",
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
                message: "Accepted plus rejected quantity cannot exceed actual quantity.",
            });
        }

        const result = await pool.query(
            `INSERT INTO production_entries (
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
                remarks
            )
            VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), $4, $5,
                    $6, $7, $8, $9, $10, $11)
            RETURNING *`,
            [
                employeeId,
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
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Production entry saved successfully.",
            entry: result.rows[0],
        });
    } catch (error) {
        console.error("Create production entry error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to save production entry.",
        });
    }
};

exports.getProductionEntries = async (req, res) => {
    try {
        const { employeeId, locationId, date, from, to } = req.query;

        const conditions = [];
        const values = [];

        if (employeeId) {
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

        const whereClause = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        const result = await pool.query(
            `SELECT
                p.*,
                e.employee_code,
                e.full_name,
                l.name AS location_name
             FROM production_entries p
             JOIN employees e ON e.id = p.employee_id
             JOIN locations l ON l.id = p.location_id
             ${whereClause}
             ORDER BY p.production_date DESC, p.created_at DESC`,
            values
        );

        return res.json({
            success: true,
            count: result.rowCount,
            entries: result.rows,
        });
    } catch (error) {
        console.error("Get production entries error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch production entries.",
        });
    }
};

exports.updateProductionEntry = async (req, res) => {
    try {
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
            `UPDATE production_entries
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
             RETURNING *`,
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

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Production entry not found.",
            });
        }

        return res.json({
            success: true,
            message: "Production entry updated successfully.",
            entry: result.rows[0],
        });
    } catch (error) {
        console.error("Update production entry error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update production entry.",
        });
    }
};

exports.deleteProductionEntry = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `DELETE FROM production_entries
             WHERE id = $1
             RETURNING id`,
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Production entry not found.",
            });
        }

        return res.json({
            success: true,
            message: "Production entry deleted successfully.",
            deletedId: result.rows[0].id,
        });
    } catch (error) {
        console.error("Delete production entry error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete production entry.",
        });
    }
};
exports.getProductionLocations = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, address
             FROM locations
             WHERE is_active = TRUE
             ORDER BY name`
        );

        res.json({
            success: true,
            locations: result.rows,
        });
    } catch (error) {
        console.error("Get production locations error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch locations.",
        });
    }
};