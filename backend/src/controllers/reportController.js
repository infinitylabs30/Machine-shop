const pool = require("../config/database");

async function getMonthlyReport(req, res) {
    const month = String(req.query.month || "");

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        return res.status(400).json({
            success: false,
            message: "Provide month as YYYY-MM.",
        });
    }

    const [year, monthNumber] = month.split("-").map(Number);
    const nextMonthDate = new Date(Date.UTC(year, monthNumber, 1));
    const nextMonth = `${nextMonthDate.getUTCFullYear()}-${String(
        nextMonthDate.getUTCMonth() + 1
    ).padStart(2, "0")}-01`;
    const firstDay = `${month}-01`;

    try {
        const [employeesResult, attendanceResult, productionResult] =
            await Promise.all([
                pool.query(
                    `SELECT id, employee_code, full_name, is_active
                     FROM employees
                     ORDER BY full_name`
                ),
                pool.query(
                    `SELECT id, employee_id, event_type, event_time, location_id
                     FROM attendance_events
                     WHERE event_time >= ($1::date::timestamp AT TIME ZONE 'Asia/Kolkata')
                       AND event_time < ($2::date::timestamp AT TIME ZONE 'Asia/Kolkata')
                     ORDER BY event_time`,
                    [firstDay, nextMonth]
                ),
                pool.query(
                    `SELECT id, employee_id, location_id, production_date,
                            shift, product_name, target_quantity,
                            actual_quantity, accepted_quantity,
                            rejected_quantity, hours_worked, remarks
                     FROM production_entries
                     WHERE production_date >= $1::date
                       AND production_date < $2::date
                     ORDER BY production_date, employee_id, id`,
                    [firstDay, nextMonth]
                ),
            ]);

        return res.json({
            success: true,
            month,
            timezone: "Asia/Kolkata",
            employees: employeesResult.rows,
            attendance: attendanceResult.rows,
            production: productionResult.rows,
        });
    } catch (error) {
        console.error("Monthly report query failed:", error.message);
        return res.status(500).json({
            success: false,
            message: "Unable to load monthly report.",
        });
    }
}

module.exports = { getMonthlyReport };
