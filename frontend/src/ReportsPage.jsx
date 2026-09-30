import { useEffect, useMemo, useState } from "react";

function currentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function csvCell(value) {
    const text = String(value ?? "");
    return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(filename, rows) {
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], {
        type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function formatDate(value) {
    if (!value) return "—";
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function formatDateTime(value) {
    if (!value) return "—";
    return new Date(value).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
    });
}

export default function ReportsPage({ token, apiBase = "" }) {
    const [month, setMonth] = useState(currentMonth);
    const [report, setReport] = useState(null);
    const [selectedEmployee, setSelectedEmployee] = useState("all");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;

        async function loadReport() {
            setLoading(true);
            setError("");
            try {
                const response = await fetch(
                    `${apiBase}/api/reports/monthly?month=${encodeURIComponent(month)}`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );
                const data = await response.json();
                if (!response.ok || !data.success) {
                    throw new Error(data.message || "Could not load report.");
                }
                if (!cancelled) {
                    setReport(data);
                    setSelectedEmployee("all");
                }
            } catch (err) {
                if (!cancelled) setError(err.message || "Report loading failed.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        if (token) loadReport();
        return () => {
            cancelled = true;
        };
    }, [month, token, apiBase]);

    const employees = report?.employees || [];
    const attendance = report?.attendance || [];
    const production = report?.production || [];

    const filteredEmployee = selectedEmployee === "all"
        ? null
        : employees.find((employee) => String(employee.id) === selectedEmployee);

    const visibleAttendance = filteredEmployee
        ? attendance.filter((row) => row.employee_id === filteredEmployee.id)
        : attendance;
    const visibleProduction = filteredEmployee
        ? production.filter((row) => row.employee_id === filteredEmployee.id)
        : production;

    const summary = useMemo(() => {
        const attendanceDays = new Set(
            visibleAttendance
                .filter((row) => row.event_type === "ENTRY")
                .map((row) =>
                    new Date(row.event_time).toLocaleDateString("en-CA", {
                        timeZone: "Asia/Kolkata",
                    })
                )
        );

        const total = (field) =>
            visibleProduction.reduce(
                (sum, row) => sum + Number(row[field] || 0),
                0
            );

        const target = total("target_quantity");
        const actual = total("actual_quantity");
        const accepted = total("accepted_quantity");
        const rejected = total("rejected_quantity");

        return {
            attendanceDays: attendanceDays.size,
            entries: visibleAttendance.filter((row) => row.event_type === "ENTRY").length,
            exits: visibleAttendance.filter((row) => row.event_type === "EXIT").length,
            productionRecords: visibleProduction.length,
            target,
            actual,
            accepted,
            rejected,
            hours: total("hours_worked"),
            targetRate: target > 0 ? (actual / target) * 100 : null,
            acceptedRate: actual > 0 ? (accepted / actual) * 100 : null,
        };
    }, [visibleAttendance, visibleProduction]);

    const selectedName = filteredEmployee
        ? `${filteredEmployee.full_name} (${filteredEmployee.employee_code})`
        : "All employees";

    function exportCsv() {
        const rows = [
            ["PRECIS Monthly Operations Report", month],
            ["Employee", selectedName],
            [],
            ["SUMMARY", "Value"],
            ["Days with ENTRY event", summary.attendanceDays],
            ["ENTRY events", summary.entries],
            ["EXIT events", summary.exits],
            ["Production records", summary.productionRecords],
            ["Target quantity", summary.target],
            ["Actual quantity", summary.actual],
            ["Accepted quantity", summary.accepted],
            ["Rejected quantity", summary.rejected],
            ["Production hours recorded", summary.hours],
            ["Target attainment (%)", summary.targetRate ?? "N/A"],
            ["Accepted rate (%)", summary.acceptedRate ?? "N/A"],
            [],
            ["ATTENDANCE EVENTS"],
            ["Employee Code", "Employee", "Event", "Timestamp (IST)", "Location ID"],
            ...visibleAttendance.map((row) => {
                const employee = employees.find((item) => item.id === row.employee_id);
                return [
                    employee?.employee_code,
                    employee?.full_name,
                    row.event_type,
                    formatDateTime(row.event_time),
                    row.location_id,
                ];
            }),
            [],
            ["PRODUCTION RECORDS"],
            [
                "Employee Code", "Employee", "Date", "Shift", "Product",
                "Target", "Actual", "Accepted", "Rejected", "Hours",
                "Location ID", "Remarks",
            ],
            ...visibleProduction.map((row) => {
                const employee = employees.find((item) => item.id === row.employee_id);
                return [
                    employee?.employee_code,
                    employee?.full_name,
                    formatDate(row.production_date),
                    row.shift,
                    row.product_name,
                    row.target_quantity,
                    row.actual_quantity,
                    row.accepted_quantity,
                    row.rejected_quantity,
                    row.hours_worked,
                    row.location_id,
                    row.remarks,
                ];
            }),
            [],
            ["Note", "Operational report only. No salary or wage calculation is included."],
        ];

        downloadCsv(`precis-report-${month}.csv`, rows);
    }

    return (
        <section className="reports-page">
            <style>{`
                .reports-page { display: grid; gap: 20px; color: var(--text-primary, inherit); }
                .reports-toolbar, .report-panel { background: var(--panel, #fff); border: 1px solid var(--border, #e5e7eb); border-radius: 14px; padding: 20px; }
                .reports-toolbar { display:flex; flex-wrap:wrap; align-items:end; justify-content:space-between; gap:16px; }
                .reports-toolbar h2 { margin: 4px 0 6px; }
                .reports-controls { display:flex; flex-wrap:wrap; gap:10px; align-items:end; }
                .reports-controls label { display:grid; gap:6px; font-size:13px; font-weight:600; }
                .reports-controls input, .reports-controls select { min-height:40px; padding:8px 10px; border:1px solid #cbd5e1; border-radius:8px; background:white; color:#172033; }
                .report-actions { display:flex; flex-wrap:wrap; gap:8px; }
                .report-actions button { min-height:40px; padding:8px 13px; border-radius:8px; border:1px solid #cbd5e1; cursor:pointer; font-weight:600; }
                .report-actions .report-primary { background:#172554; color:white; border-color:#172554; }
                .report-summary { display:grid; grid-template-columns:repeat(auto-fit,minmax(155px,1fr)); gap:12px; }
                .report-metric { background:var(--panel, #fff); border:1px solid var(--border, #e5e7eb); border-radius:12px; padding:16px; min-width:0; }
                .report-metric span { display:block; color:#64748b; font-size:12px; margin-bottom:9px; }
                .report-metric strong { font-size:24px; overflow-wrap:anywhere; }
                .report-panel h3 { margin:0 0 14px; }
                .report-table-wrap { overflow-x:auto; }
                .report-table { width:100%; border-collapse:collapse; font-size:13px; }
                .report-table th,.report-table td { padding:11px 10px; border-bottom:1px solid #e5e7eb; text-align:left; white-space:nowrap; }
                .report-table th { color:#64748b; font-size:11px; text-transform:uppercase; letter-spacing:.04em; }
                .report-bar-row { display:grid; grid-template-columns:minmax(110px,1fr) 3fr 55px; align-items:center; gap:12px; margin:13px 0; font-size:13px; }
                .report-bar-track { height:10px; background:#e2e8f0; border-radius:99px; overflow:hidden; }
                .report-bar-fill { height:100%; background:#2563eb; border-radius:99px; }
                .report-note { color:#64748b; font-size:12px; line-height:1.5; }
                .report-error { color:#b91c1c; background:#fef2f2; padding:12px; border-radius:8px; }
                @media print {
                    body { background:white !important; }
                    .reports-toolbar .report-actions, .reports-controls { display:none !important; }
                    .reports-page { gap:10px; }
                    .reports-toolbar,.report-panel,.report-metric { break-inside:avoid; box-shadow:none !important; }
                    .report-table { font-size:10px; }
                    .report-table th,.report-table td { padding:5px; }
                }
            `}</style>

            <div className="reports-toolbar">
                <div>
                    <span className="section-label">PRECIS · OPERATIONS</span>
                    <h2>Monthly Reports</h2>
                    <p className="report-note">Attendance and production activity for the selected calendar month.</p>
                </div>
                <div className="reports-controls">
                    <label>
                        Month
                        <input
                            type="month"
                            value={month}
                            onChange={(event) => setMonth(event.target.value)}
                        />
                    </label>
                    <label>
                        Employee
                        <select
                            value={selectedEmployee}
                            onChange={(event) => setSelectedEmployee(event.target.value)}
                        >
                            <option value="all">All employees</option>
                            {employees.map((employee) => (
                                <option key={employee.id} value={employee.id}>
                                    {employee.full_name} · {employee.employee_code}
                                </option>
                            ))}
                        </select>
                    </label>
                    <div className="report-actions">
                        <button type="button" onClick={exportCsv} disabled={!report || loading}>
                            Export Excel-compatible CSV
                        </button>
                        <button
                            type="button"
                            className="report-primary"
                            onClick={() => window.print()}
                            disabled={!report || loading}
                        >
                            Print / Save PDF
                        </button>
                    </div>
                </div>
            </div>

            {loading && <div className="report-panel">Loading monthly report…</div>}
            {error && <div className="report-error">{error}</div>}

            {report && !loading && (
                <>
                    <div className="report-summary">
                        <div className="report-metric"><span>Days with ENTRY</span><strong>{summary.attendanceDays}</strong></div>
                        <div className="report-metric"><span>ENTRY / EXIT events</span><strong>{summary.entries} / {summary.exits}</strong></div>
                        <div className="report-metric"><span>Production records</span><strong>{summary.productionRecords}</strong></div>
                        <div className="report-metric"><span>Actual quantity</span><strong>{summary.actual.toLocaleString("en-IN")}</strong></div>
                        <div className="report-metric"><span>Accepted / Rejected</span><strong>{summary.accepted.toLocaleString("en-IN")} / {summary.rejected.toLocaleString("en-IN")}</strong></div>
                        <div className="report-metric"><span>Production hours recorded</span><strong>{summary.hours.toLocaleString("en-IN")}</strong></div>
                    </div>

                    <div className="report-panel">
                        <h3>Production indicators</h3>
                        <div className="report-bar-row">
                            <span>Target attainment</span>
                            <div className="report-bar-track">
                                <div className="report-bar-fill" style={{ width: `${Math.min(summary.targetRate ?? 0, 100)}%` }} />
                            </div>
                            <strong>{summary.targetRate === null ? "N/A" : `${summary.targetRate.toFixed(1)}%`}</strong>
                        </div>
                        <div className="report-bar-row">
                            <span>Accepted rate</span>
                            <div className="report-bar-track">
                                <div className="report-bar-fill" style={{ width: `${Math.min(summary.acceptedRate ?? 0, 100)}%` }} />
                            </div>
                            <strong>{summary.acceptedRate === null ? "N/A" : `${summary.acceptedRate.toFixed(1)}%`}</strong>
                        </div>
                        <p className="report-note">
                            Target attainment = actual quantity ÷ target quantity. Accepted rate = accepted quantity ÷ actual quantity.
                            These are separate operational indicators, not a salary or payroll calculation.
                        </p>
                    </div>

                    <div className="report-panel">
                        <h3>Attendance events · {selectedName}</h3>
                        {visibleAttendance.length === 0 ? (
                            <p className="report-note">No attendance events found for this selection and month.</p>
                        ) : (
                            <div className="report-table-wrap">
                                <table className="report-table">
                                    <thead><tr><th>Employee</th><th>Event</th><th>Date & time (IST)</th><th>Location ID</th></tr></thead>
                                    <tbody>
                                        {visibleAttendance.map((row) => {
                                            const employee = employees.find((item) => item.id === row.employee_id);
                                            return (
                                                <tr key={row.id}>
                                                    <td>{employee?.full_name || "Employee"} · {employee?.employee_code || ""}</td>
                                                    <td>{row.event_type}</td>
                                                    <td>{formatDateTime(row.event_time)}</td>
                                                    <td>{row.location_id ?? "—"}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="report-panel">
                        <h3>Production records · {selectedName}</h3>
                        {visibleProduction.length === 0 ? (
                            <p className="report-note">No production entries found for this selection and month.</p>
                        ) : (
                            <div className="report-table-wrap">
                                <table className="report-table">
                                    <thead>
                                        <tr><th>Date</th><th>Employee</th><th>Shift</th><th>Product</th><th>Target</th><th>Actual</th><th>Accepted</th><th>Rejected</th><th>Hours</th><th>Unit ID</th></tr>
                                    </thead>
                                    <tbody>
                                        {visibleProduction.map((row) => {
                                            const employee = employees.find((item) => item.id === row.employee_id);
                                            return (
                                                <tr key={row.id}>
                                                    <td>{formatDate(row.production_date)}</td>
                                                    <td>{employee?.full_name || "Employee"}</td>
                                                    <td>{row.shift || "—"}</td>
                                                    <td>{row.product_name}</td>
                                                    <td>{row.target_quantity}</td>
                                                    <td>{row.actual_quantity}</td>
                                                    <td>{row.accepted_quantity}</td>
                                                    <td>{row.rejected_quantity}</td>
                                                    <td>{row.hours_worked}</td>
                                                    <td>{row.location_id ?? "—"}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                    <p className="report-note">
                        Report timezone: Asia/Kolkata. A day with an ENTRY event is counted as an attendance day.
                        This report does not infer absences, calculate attendance duration, or calculate salary.
                        Production hours are the hours entered on production records, not attendance duration.
                    </p>
                </>
            )}
        </section>
    );
}
