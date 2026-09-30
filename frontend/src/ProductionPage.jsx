import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:5000" : "");

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

export default function ProductionPage({ token }) {
    const [employees, setEmployees] = useState([]);
    const [locations, setLocations] = useState([]);
    const [entries, setEntries] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    async function loadData() {
        try {
            const [employeeResponse, locationResponse, productionResponse] =
                await Promise.all([
                    fetch(`${API}/api/employees`, {
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                    fetch(`${API}/api/production/locations`, {
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                    fetch(`${API}/api/production`, {
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                ]);

            const [employeeData, locationData, productionData] =
                await Promise.all([
                    employeeResponse.json(),
                    locationResponse.json(),
                    productionResponse.json(),
                ]);

            if (!employeeResponse.ok || !employeeData.success) {
                throw new Error(employeeData.message || "Could not load employees.");
            }

            if (!locationResponse.ok || !locationData.success) {
                throw new Error(locationData.message || "Could not load locations.");
            }

            if (!productionResponse.ok || !productionData.success) {
                throw new Error(productionData.message || "Could not load production.");
            }

            setEmployees(employeeData.employees || []);
            setLocations(locationData.locations || []);
            setEntries(productionData.entries || []);
        } catch (error) {
            setMessage(error.message);
        }
    }

    useEffect(() => {
        loadData();
    }, []);

    function handleChange(event) {
        const { name, value } = event.target;
        setForm((previous) => ({ ...previous, [name]: value }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setLoading(true);
        setMessage("");

        try {
            const payload = {
                ...form,
                employeeId: Number(form.employeeId),
                locationId: Number(form.locationId),
                targetQuantity: Number(form.targetQuantity || 0),
                actualQuantity: Number(form.actualQuantity),
                acceptedQuantity: Number(form.acceptedQuantity || 0),
                rejectedQuantity: Number(form.rejectedQuantity || 0),
                hoursWorked: Number(form.hoursWorked || 0),
            };

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
                throw new Error(data.message || "Unable to save production entry.");
            }

            setMessage(data.message);
            setForm(emptyForm);
            setEditingId(null);
            await loadData();
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    }

    function startEditing(entry) {
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

        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    async function deleteEntry(id) {
        if (!window.confirm("Delete this production entry?")) return;

        try {
            const response = await fetch(`${API}/api/production/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Unable to delete entry.");
            }

            setMessage(data.message);
            await loadData();
        } catch (error) {
            setMessage(error.message);
        }
    }

    function cancelEditing() {
        setEditingId(null);
        setForm(emptyForm);
        setMessage("");
    }

    return (
        <main className="production-page">
            <h1>Daily Production</h1>
            <p>Record worker production and review daily entries.</p>

            {message && <div className="production-message">{message}</div>}

            <form className="production-form" onSubmit={handleSubmit}>
                <h2>{editingId ? "Edit Production Entry" : "Add Production Entry"}</h2>

                <label>
                    Employee
                    <select
                        name="employeeId"
                        value={form.employeeId}
                        onChange={handleChange}
                        required
                    >
                        <option value="">Select employee</option>
                        {employees.map((employee) => (
                            <option key={employee.id} value={employee.id}>
                                {employee.employee_code} — {employee.full_name}
                            </option>
                        ))}
                    </select>
                </label>

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
                    <select name="shift" value={form.shift} onChange={handleChange}>
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
                                : "Save Production"}
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
                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {entries.map((entry) => (
                                <tr key={entry.id}>
                                    <td>{String(entry.production_date).slice(0, 10)}</td>
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
                                        <button type="button" onClick={() => startEditing(entry)}>
                                            Edit
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => deleteEntry(entry.id)}
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}

                            {entries.length === 0 && (
                                <tr>
                                    <td colSpan="10">No production entries found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </main>
    );
}