const pool = require("../config/database");

async function getDashboardSummary(req, res) {
    try {
        const [summaryResult, activityResult] = await Promise.all([
            pool.query(`
                WITH ist_day AS (
                    SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date AS day
                ),
                day_events AS (
                    SELECT ae.id, ae.employee_id, ae.event_type, ae.event_time
                    FROM attendance_events ae
                    CROSS JOIN ist_day d
                    WHERE ae.event_time >= (d.day::timestamp AT TIME ZONE 'Asia/Kolkata')
                      AND ae.event_time < ((d.day + 1)::timestamp AT TIME ZONE 'Asia/Kolkata')
                ),
                latest_event_per_employee AS (
                    SELECT DISTINCT ON (employee_id)
                        employee_id,
                        event_type
                    FROM day_events
                    ORDER BY employee_id, event_time DESC, id DESC
                ),
                production_today AS (
                    SELECT
                        COALESCE(SUM(pe.actual_quantity), 0) AS actual_quantity,
                        COUNT(*)::int AS record_count
                    FROM production_entries pe
                    CROSS JOIN ist_day d
                    WHERE pe.production_date = d.day
                )
                SELECT
                    (SELECT COUNT(*)
                     FROM latest_event_per_employee
                     WHERE event_type = 'ENTRY')::int AS checked_in,
                    (SELECT COUNT(*) FROM day_events
                     WHERE event_type = 'ENTRY')::int AS entries,
                    (SELECT COUNT(*) FROM day_events
                     WHERE event_type = 'EXIT')::int AS exits,
                    (SELECT actual_quantity FROM production_today) AS production_output,
                    (SELECT record_count FROM production_today) AS production_records
            `),
            pool.query(`
                WITH ist_day AS (
                    SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date AS day
                )
                SELECT
                    ae.id,
                    e.full_name AS employee_name,
                    e.employee_code,
                    ae.event_type,
                    ae.event_time,
                    l.name AS location_name
                FROM attendance_events ae
                JOIN employees e ON e.id = ae.employee_id
                JOIN locations l ON l.id = ae.location_id
                CROSS JOIN ist_day d
                WHERE ae.event_time >= (d.day::timestamp AT TIME ZONE 'Asia/Kolkata')
                  AND ae.event_time < ((d.day + 1)::timestamp AT TIME ZONE 'Asia/Kolkata')
                ORDER BY ae.event_time DESC, ae.id DESC
                LIMIT 8
            `),
        ]);

        return res.json({
            success: true,
            timezone: "Asia/Kolkata",
            summary: summaryResult.rows[0],
            recentActivity: activityResult.rows,
            generatedAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error("Dashboard summary failed:", error.message);
        return res.status(500).json({
            success: false,
            message: "Unable to load dashboard data",
        });
    }
}

module.exports = { getDashboardSummary };
