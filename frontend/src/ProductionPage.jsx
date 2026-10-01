import { useCallback, useEffect, useState } from "react";

const API =
    import.meta.env.VITE_API_URL ??
    (import.meta.env.DEV ? "http://localhost:5000" : "");

const emptyForm = {
    employeeId: "",
    locationId: "",
    productionDate: new Date().toLocaleDateString("en-CA"),
    shift: "General",
    productName: "",
    targetQuantity: "",
    actualQuantity: "",
    acceptedQuantity: "",
    rejectedQuantity: "",
    hoursWorked: "",
    remarks: "",
};

export default function ProductionPage({ token, authUser }) {
    const [employees, setEmployees] = useState([]);
    const [locations, setLocations] = useState([]);
    const [entries, setEntries] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    const isActualAdmin = authUser?.role === "admin";

    const normalizedDesignation = String(authUser?.designation || "")
        .trim()
        .toLowerCase();

    const canVerify =
        isActualAdmin ||
        normalizedDesignation === "supervisor" ||
        normalizedDesignation === "admin";

    const authHeaders = {
        Authorization: `Bearer ${token}`,
    };

    const loadData = useCallback(async () => {
        try {
            setMessage("");

            const requests = [
                fetch(`${API}/api/production/locations`, {
                    headers: authHeaders,
                }),
                fetch(`${API}/api/production`, {
                    headers: authHeaders,
                }),
            ];

            if (isActualAdmin) {
                requests.push(
                    fetch(`${API}/api/employees`, {
                        headers: authHeaders,
                    })
                );
            }

            const responses = await Promise.all(requests);
            const [locationResponse, productionResponse, employeeResponse] =
                responses;

            const locationData = await locationResponse.json();
            const productionData = await productionResponse.json();

            if (!locationResponse.ok || !locationData.success) {
                throw new Error(
                    locationData.message || "Could not load production locations."
                );
            }

            if (!productionResponse.ok || !productionData.success) {
                throw new Error(
                    productionData.message || "Could not load production records."
                );
            }

            setLocations(locationData.locations || []);
            setEntries(productionData.entries || []);

            if (isActualAdmin) {
                const employeeData = await employeeResponse.json();

                if (!employeeResponse.ok || !employeeData.success) {
                    throw new Error(
                        employeeData.message || "Could not load employees."
                    );
                }

                setEmployees(employeeData.employees || []);
            } else {
                setEmployees([]);
            }
        } catch (error) {
            setMessage(error.message || "Unable to load production data.");
        }
    }, [token, isActualAdmin]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    function handleChange(event) {
        const { name, value } = event.target;

        setForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    }

    async function handleSubmit(event) {
        event.preventDefault();

        setLoading(true);
        setMessage("");

        try {
            const payload = {
                locationId: Number(form.locationId),
                productionDate: form.productionDate,
                shift: form.shift,
                productName: form.productName.trim(),
                targetQuantity: Number(form.targetQuantity || 0),
                actualQuantity: Number(form.actualQuantity),
                acceptedQuantity: Number(form.acceptedQuantity || 0),
                rejectedQuantity: Number(form.rejectedQuantity || 0),
                hoursWorked: Number(form.hoursWorked || 0),
                remarks: form.remarks.trim(),
            };

            // Only actual admins can submit production for another employee.
            if (isActualAdmin) {
                payload.employeeId = Number(form.employeeId);
            }

            const response = await fetch(
                editingId
                    ? `${API}/api/production/${editingId}`
                    : `${API}/api/production`,
                {
                    method: editingId ? "PUT" : "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(payload),
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Unable to save production entry."
                );
            }

            setMessage(data.message || "Production entry saved.");
            setForm(emptyForm);
            setEditingId(null);

            await loadData();
        } catch (error) {
            setMessage(error.message || "Unable to save production entry.");
        } finally {
            setLoading(false);
        }
    }

    function startEditing(entry) {
        if (!isActualAdmin || entry.approval_status !== "pending") {
            return;
        }

        setEditingId(entry.id);

        setForm({
            employeeId: String(entry.employee_id),
            locationId: String(entry.location_id),
            productionDate: String(entry.production_date).slice(0, 10),
            shift: entry.shift || "General",
            productName: entry.product_name || "",
            targetQuantity: String(entry.target_quantity ?? 0),
            actualQuantity: String(entry.actual_quantity ?? 0),
            acceptedQuantity: String(entry.accepted_quantity ?? 0),
            rejectedQuantity: String(entry.rejected_quantity ?? 0),
            hoursWorked: String(entry.hours_worked ?? 0),
            remarks: entry.remarks || "",
        });

        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    }

    async function deleteEntry(id) {
        if (!isActualAdmin) return;

        const confirmed = window.confirm(
            "Delete this pending production entry?"
        );

        if (!confirmed) return;

        try {
            const response = await fetch(`${API}/api/production/${id}`, {
                method: "DELETE",
                headers: authHeaders,
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Unable to delete entry.");
            }

            setMessage(data.message || "Production entry deleted.");
            await loadData();
        } catch (error) {
            setMessage(error.message || "Unable to delete entry.");
        }
    }

    async function verifyEntry(entry, status) {
        if (!canVerify || entry.approval_status !== "pending") {
            return;
        }

        let rejectionReason;

        if (status === "rejected") {
            rejectionReason = window.prompt(
                "Enter the reason for rejecting this production entry:"
            );

            if (rejectionReason === null) return;

            rejectionReason = rejectionReason.trim();

            if (!rejectionReason) {
                setMessage("A rejection reason is required.");
                return;
            }
        }

        try {
            setMessage("");

            const payload = { status };

            if (status === "rejected") {
                payload.rejectionReason = rejectionReason;
            }

            const response = await fetch(
                `${API}/api/production/${entry.id}/verify`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(payload),
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Unable to verify production entry."
                );
            }

            setMessage(data.message || `Entry ${status}.`);
            await loadData();
        } catch (error) {
            setMessage(error.message || "Unable to verify entry.");
        }
    }

    function cancelEditing() {
        setEditingId(null);
        setForm(emptyForm);
        setMessage("");
    }

    function formatStatus(status) {
        if (!status) return "Unknown";

        return status.charAt(0).toUpperCase() + status.slice(1);
    }

    return (
        <main className="production-page">
            <h1>Daily Production</h1>

            <p>
                {isActualAdmin
                    ? "Record production for employees and review production entries."
                    : "Submit your daily production and track its approval status."}
            </p>

            {message && (
                <div className="production-message" role="status">
                    {message}
                </div>
            )}

            <form className="production-form" onSubmit={handleSubmit}>
                <h2>
                    {editingId ? "Edit Production Entry" : "Submit Production"}
                </h2>

                {isActualAdmin && (
                    <label>
                        Employee
                        <select
                            name="employeeId"
                            value={form.employeeId}
                            onChange={handleChange}
                            required
                        >
                            <option value="">Select employee</option>

                            {employees
                                .filter((employee) => employee.employee_code === "PCSP001")
                                .map((employee) => (
                                    <option key={employee.id} value={employee.id}>
                                        {employee.full_name} — {employee.employee_code}
                                    </option>
                                ))}
                        </select>
                    </label>
                )}

                {!isActualAdmin && (
                    <p>
                        Submitting as:{" "}
                        <strong>
                            {authUser?.fullName || authUser?.username || "Employee"}
                        </strong>
                    </p>
                )}

                <label>
                    Unit
                    <select
                        name="locationId"
                        value={form.locationId}
                        onChange={handleChange}
                        required
                    >
                        <option value="">Select unit</option>

                        {locations.map((location) => (
                            <option key={location.id} value={location.id}>
                                {location.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label>
                    Production Date
                    <input
                        type="date"
                        name="productionDate"
                        value={form.productionDate}
                        onChange={handleChange}
                        required
                    />
                </label>

                <label>
                    Shift
                    <select
                        name="shift"
                        value={form.shift}
                        onChange={handleChange}
                    >
                        <option>General</option>
                        <option>Morning</option>
                        <option>Evening</option>
                        <option>Night</option>
                    </select>
                </label>

                <label>
                    Product / Casting
                    <input
                        name="productName"
                        value={form.productName}
                        onChange={handleChange}
                        placeholder="Product name"
                        required
                    />
                </label>

                <label>
                    Target Quantity
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        name="targetQuantity"
                        value={form.targetQuantity}
                        onChange={handleChange}
                    />
                </label>

                <label>
                    Actual Quantity
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        name="actualQuantity"
                        value={form.actualQuantity}
                        onChange={handleChange}
                        required
                    />
                </label>

                <label>
                    Accepted Quantity
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        name="acceptedQuantity"
                        value={form.acceptedQuantity}
                        onChange={handleChange}
                    />
                </label>

                <label>
                    Rejected Quantity
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        name="rejectedQuantity"
                        value={form.rejectedQuantity}
                        onChange={handleChange}
                    />
                </label>

                <label>
                    Hours Worked
                    <input
                        type="number"
                        min="0"
                        step="0.25"
                        name="hoursWorked"
                        value={form.hoursWorked}
                        onChange={handleChange}
                    />
                </label>

                <label className="production-full-width">
                    Remarks
                    <textarea
                        name="remarks"
                        value={form.remarks}
                        onChange={handleChange}
                        rows="3"
                        placeholder="Optional notes"
                    />
                </label>

                <div className="production-actions production-full-width">
                    <button type="submit" disabled={loading}>
                        {loading
                            ? "Saving..."
                            : editingId
                              ? "Update Entry"
                              : "Submit Production"}
                    </button>

                    {editingId && (
                        <button type="button" onClick={cancelEditing}>
                            Cancel
                        </button>
                    )}
                </div>
            </form>

            <section className="production-records">
                <h2>Production Records</h2>

                <div className="production-table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Employee</th>
                                <th>Unit</th>
                                <th>Product</th>
                                <th>Target</th>
                                <th>Actual</th>
                                <th>Accepted</th>
                                <th>Rejected</th>
                                <th>Hours</th>
                                <th>Status</th>
                                <th>Remarks</th>
                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {entries.map((entry) => {
                                const isPending =
                                    entry.approval_status === "pending";

                                const isOwnSubmission =
                                    String(entry.submitted_by) ===
                                    String(authUser?.id);

                                const canReviewThisEntry =
                                    canVerify &&
                                    isPending &&
                                    !isOwnSubmission;

                                return (
                                    <tr key={entry.id}>
                                        <td>
                                            {String(entry.production_date).slice(
                                                0,
                                                10
                                            )}
                                        </td>

                                        <td>
                                            {entry.employee_code} — {entry.full_name}
                                        </td>

                                        <td>{entry.location_name}</td>
                                        <td>{entry.product_name}</td>
                                        <td>{entry.target_quantity}</td>
                                        <td>{entry.actual_quantity}</td>
                                        <td>{entry.accepted_quantity}</td>
                                        <td>{entry.rejected_quantity}</td>
                                        <td>{entry.hours_worked}</td>

                                        <td>
                                            <strong>
                                                {formatStatus(entry.approval_status)}
                                            </strong>

                                            {entry.rejection_reason && (
                                                <div>
                                                    Reason: {entry.rejection_reason}
                                                </div>
                                            )}
                                        </td>

                                        <td>{entry.remarks || "—"}</td>

                                        <td>
                                            {isActualAdmin && isPending && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            startEditing(entry)
                                                        }
                                                    >
                                                        Edit
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            deleteEntry(entry.id)
                                                        }
                                                    >
                                                        Delete
                                                    </button>
                                                </>
                                            )}

                                            {canReviewThisEntry && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            verifyEntry(
                                                                entry,
                                                                "approved"
                                                            )
                                                        }
                                                    >
                                                        Approve
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            verifyEntry(
                                                                entry,
                                                                "rejected"
                                                            )
                                                        }
                                                    >
                                                        Reject
                                                    </button>
                                                </>
                                            )}

                                            {canVerify &&
                                                isPending &&
                                                isOwnSubmission && (
                                                    <span>
                                                        Cannot verify own entry
                                                    </span>
                                                )}
                                        </td>
                                    </tr>
                                );
                            })}

                            {entries.length === 0 && (
                                <tr>
                                    <td colSpan="12">
                                        No production entries found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </main>
    );
}