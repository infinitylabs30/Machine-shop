import { useEffect, useRef, useState } from "react";
import "./App.css";
import ProductionPage from "./ProductionPage";
const API = "http://localhost:5000";

function App() {
    const [page, setPage] = useState("dashboard");
    const [mobileOpen, setMobileOpen] = useState(false);
    const [employeeCode, setEmployeeCode] = useState("");
    const [eventType, setEventType] = useState("ENTRY");
    const [cameraActive, setCameraActive] = useState(false);
    const [location, setLocation] = useState(null);
    const [locationStatus, setLocationStatus] = useState("Waiting");
    const [detectedLocation, setDetectedLocation] = useState(null);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const [registeringEmployee, setRegisteringEmployee] = useState(null);
    const [registerCameraActive, setRegisterCameraActive] = useState(false);
    const [registering, setRegistering] = useState(false);
    const [registerMessage, setRegisterMessage] = useState("");

    const registerVideoRef = useRef(null);
    const registerCanvasRef = useRef(null);
    const registerStreamRef = useRef(null);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    const navItems = [
        { id: "dashboard", label: "Dashboard", icon: "⌂" },
        { id: "attendance", label: "Attendance", icon: "◷" },
        { id: "employees", label: "Employees", icon: "♙" },
        { id: "production", label: "Production", icon: "▦" },
        { id: "reports", label: "Reports", icon: "◫" },
    ];

    useEffect(() => {
        if (cameraActive && videoRef.current && streamRef.current) {
            const video = videoRef.current;

            video.srcObject = streamRef.current;

            const playVideo = async () => {
                try {
                    await video.play();
                } catch (error) {
                    console.error("Video playback error:", error);
                }
            };

            playVideo();
        }
    }, [cameraActive]);

    useEffect(() => {
        return () => {
            stopCamera();
            stopRegistrationCamera();
        };
    }, []);

    useEffect(() => {
        if (
            registerCameraActive &&
            registerVideoRef.current &&
            registerStreamRef.current
        ) {
            const video = registerVideoRef.current;
            video.srcObject = registerStreamRef.current;

            video.play().catch((error) => {
                console.error("Registration camera playback error:", error);
            });
        }
    }, [registerCameraActive]);

    async function startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "user",
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: false,
            });

            streamRef.current = stream;
            setCameraActive(true);
        } catch (error) {
            setMessage("Camera access was not available.");
            console.error(error);
        }
    }

    function stopCamera() {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }

        setCameraActive(false);
    }

    function getLocation() {
        if (!navigator.geolocation) {
            setLocationStatus("Unavailable");
            return;
        }

        setLocationStatus("Locating…");

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                });

                setLocationStatus("Location detected");
            },
            () => {
                setLocationStatus("Location denied");
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0,
            }
        );
    }

    function captureFace() {
        if (!videoRef.current || !canvasRef.current) {
            return null;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;

        const maxWidth = 640;
        const scale = Math.min(1, maxWidth / (video.videoWidth || 1280));

        canvas.width = Math.round((video.videoWidth || 1280) * scale);
        canvas.height = Math.round((video.videoHeight || 720) * scale);

        const context = canvas.getContext("2d");

        context.save();
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        context.drawImage(
            video,
            0,
            0,
            canvas.width,
            canvas.height
        );
        context.restore();

        return canvas.toDataURL("image/jpeg", 0.72);
    }

    async function markAttendance() {
        setMessage("");

        if (!employeeCode.trim()) {
            setMessage("Enter the employee ID first.");
            return;
        }

        if (!cameraActive) {
            setMessage("Start the camera before marking attendance.");
            return;
        }

        if (!location) {
            getLocation();
            setMessage("Waiting for your location…");
            return;
        }

        const faceImage = captureFace();

        if (!faceImage) {
            setMessage("Unable to capture the face.");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`${API}/api/attendance/mark`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    employeeCode: employeeCode.trim(),
                    eventType,
                    latitude: location.latitude,
                    longitude: location.longitude,
                    deviceInfo: navigator.userAgent,
                    faceImage,
                }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Attendance could not be recorded."
                );
            }

            if (data.location) {
                setDetectedLocation({
                    name: data.location,
                    distance: Number(data.distanceMeters || 0),
                });
            }

            setMessage(
                `${eventType === "ENTRY" ? "Entry" : "Exit"} recorded successfully.`
            );
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    }

    async function startRegistrationCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "user",
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: false,
            });

            registerStreamRef.current = stream;
            setRegisterCameraActive(true);
            setRegisterMessage("");
        } catch (error) {
            console.error(error);
            setRegisterMessage("Camera access was not available.");
        }
    }

    function stopRegistrationCamera() {
        if (registerStreamRef.current) {
            registerStreamRef.current
                .getTracks()
                .forEach((track) => track.stop());

            registerStreamRef.current = null;
        }

        setRegisterCameraActive(false);
    }

    function captureRegistrationFace() {
        const video = registerVideoRef.current;
        const canvas = registerCanvasRef.current;

        if (!video || !canvas) {
            return null;
        }

        const maxWidth = 640;
        const scale = Math.min(
            1,
            maxWidth / (video.videoWidth || 1280)
        );

        canvas.width = Math.round((video.videoWidth || 1280) * scale);
        canvas.height = Math.round((video.videoHeight || 720) * scale);

        const context = canvas.getContext("2d");

        context.save();
        context.translate(canvas.width, 0);
        context.scale(-1, 1);

        context.drawImage(
            video,
            0,
            0,
            canvas.width,
            canvas.height
        );

        context.restore();

        return canvas.toDataURL("image/jpeg", 0.72);
    }

    async function registerEmployeeFace() {
        if (!registeringEmployee) {
            return;
        }

        if (!registerCameraActive) {
            setRegisterMessage("Start the camera first.");
            return;
        }

        const faceImage = captureRegistrationFace();

        if (!faceImage) {
            setRegisterMessage("Unable to capture the face.");
            return;
        }

        setRegistering(true);
        setRegisterMessage("Detecting and registering face…");

        try {
            const response = await fetch(`${API}/api/face/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    employeeCode: registeringEmployee.employeeCode,
                    faceImage,
                }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Face registration failed."
                );
            }

            setRegisterMessage("Face registered successfully.");

            setTimeout(() => {
                stopRegistrationCamera();
                setRegisteringEmployee(null);
            }, 1600);
        } catch (error) {
            console.error(error);
            setRegisterMessage(error.message);
        } finally {
            setRegistering(false);
        }
    }

    function renderPage() {
        if (page === "attendance") {
            return (
                <AttendancePage
                    employeeCode={employeeCode}
                    setEmployeeCode={setEmployeeCode}
                    eventType={eventType}
                    setEventType={setEventType}
                    cameraActive={cameraActive}
                    startCamera={startCamera}
                    stopCamera={stopCamera}
                    videoRef={videoRef}
                    canvasRef={canvasRef}
                    locationStatus={locationStatus}
                    getLocation={getLocation}
                    markAttendance={markAttendance}
                    loading={loading}
                    message={message}
                    detectedLocation={detectedLocation}
                />
            );
        }

        if (page === "employees") {
            return (
                <EmployeesPage
                    onRegisterFace={(employee) => {
                        setRegisteringEmployee(employee);
                        setRegisterMessage("");
                        setRegisterCameraActive(false);
                    }}
                />
            );
        }

        if (page === "production") {
            return <ProductionPage />;
        }

        if (page === "reports") {
            return <ComingSoon title="Reports" />;
        }

        return <Dashboard setPage={setPage} />;
    }

    return (
        <div className="app-shell">
            <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
                <div className="brand">
                    <img
                        src="/precis-logo.png"
                        alt="PRECIS"
                        className="brand-logo"
                        onError={(e) => {
                            e.currentTarget.style.display = "none";
                        }}
                    />

                    <div className="brand-fallback">
                        <span>PRECIS</span>
                        <small>FOUNDRY SYSTEMS</small>
                    </div>
                </div>

                <div className="workspace-label">WORKSPACE</div>

                <nav className="navigation">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            className={`nav-item ${page === item.id ? "active" : ""}`}
                            onClick={() => {
                                setPage(item.id);
                                setMobileOpen(false);
                            }}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            <span>{item.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="sidebar-bottom">
                    <div className="unit-card">
                        <span className="status-dot" />
                        <div>
                            <strong>Shiroli Unit</strong>
                            <small>System operational</small>
                        </div>
                    </div>

                    <button className="settings-button">
                        <span>⚙</span>
                        Settings
                    </button>
                </div>
            </aside>

            <main className="main-area">
                <header className="topbar">
                    <button
                        className="mobile-menu"
                        onClick={() => setMobileOpen(!mobileOpen)}
                    >
                        ☰
                    </button>

                    <div>
                        <p className="eyebrow">PRECIS / FOUNDRY OPERATIONS</p>
                        <h1>
                            {page === "dashboard"
                                ? "Good evening."
                                : navItems.find((item) => item.id === page)?.label}
                        </h1>
                    </div>

                    <div className="topbar-actions">
                        <button className="icon-button" title="Notifications">
                            ◌
                        </button>

                        <div className="profile">
                            <div className="avatar">SA</div>
                            <div className="profile-copy">
                                <strong>Administrator</strong>
                                <span>System Admin</span>
                            </div>
                            <span className="chevron">⌄</span>
                        </div>
                    </div>
                </header>

                <section className="content">{renderPage()}</section>
            </main>

            {registeringEmployee && (
                <FaceRegistrationModal
                    employee={registeringEmployee}
                    videoRef={registerVideoRef}
                    canvasRef={registerCanvasRef}
                    cameraActive={registerCameraActive}
                    startCamera={startRegistrationCamera}
                    stopCamera={stopRegistrationCamera}
                    registerFace={registerEmployeeFace}
                    registering={registering}
                    message={registerMessage}
                    close={() => {
                        stopRegistrationCamera();
                        setRegisteringEmployee(null);
                    }}
                />
            )}
        </div>
    );
}

function Dashboard({ setPage }) {
    return (
        <>
            <section className="hero">
                <div>
                    <span className="hero-tag">LIVE OPERATIONS</span>
                    <h2>Everything under control.</h2>
                    <p>
                        Monitor attendance, workforce activity and plant operations
                        from one intelligent workspace.
                    </p>
                </div>

                <button
                    className="primary-button"
                    onClick={() => setPage("attendance")}
                >
                    Mark attendance <span>→</span>
                </button>
            </section>

            <div className="metrics-grid">
                <Metric
                    label="Present today"
                    value="42"
                    change="+8.4%"
                    description="vs. previous working day"
                />
                <Metric
                    label="Entries"
                    value="38"
                    change="Today"
                    description="verified check-ins"
                />
                <Metric
                    label="Exits"
                    value="31"
                    change="Today"
                    description="verified check-outs"
                />
                <Metric
                    label="Units online"
                    value="01"
                    change="Operational"
                    description="Shiroli production unit"
                />
            </div>

            <div className="dashboard-grid">
                <section className="panel attendance-panel">
                    <div className="panel-heading">
                        <div>
                            <span className="section-label">ATTENDANCE</span>
                            <h3>Today's activity</h3>
                        </div>
                        <button
                            className="text-button"
                            onClick={() => setPage("attendance")}
                        >
                            View all →
                        </button>
                    </div>

                    <div className="attendance-list">
                        <AttendanceRow
                            name="Employee 001"
                            id="TEST001"
                            type="ENTRY"
                            time="09:08 AM"
                        />
                        <AttendanceRow
                            name="Employee 002"
                            id="EMP002"
                            type="ENTRY"
                            time="09:14 AM"
                        />
                        <AttendanceRow
                            name="Employee 003"
                            id="EMP003"
                            type="EXIT"
                            time="06:02 PM"
                        />
                        <AttendanceRow
                            name="Employee 004"
                            id="EMP004"
                            type="ENTRY"
                            time="09:27 AM"
                        />
                    </div>
                </section>

                <section className="panel status-panel">
                    <div className="panel-heading">
                        <div>
                            <span className="section-label">SYSTEM</span>
                            <h3>Operational status</h3>
                        </div>
                        <span className="live-pill">LIVE</span>
                    </div>

                    <div className="system-status">
                        <StatusItem label="Attendance API" />
                        <StatusItem label="Face verification" />
                        <StatusItem label="Location service" />
                        <StatusItem label="Database" />
                    </div>

                    <div className="last-sync">
                        <span>Last synchronization</span>
                        <strong>Just now</strong>
                    </div>
                </section>
            </div>
        </>
    );
}

function AttendancePage({
    employeeCode,
    setEmployeeCode,
    eventType,
    setEventType,
    cameraActive,
    startCamera,
    stopCamera,
    videoRef,
    canvasRef,
    locationStatus,
    getLocation,
    markAttendance,
    loading,
    message,
    detectedLocation,
}) {
    return (
        <div className="attendance-page">
            <div className="page-intro">
                <div>
                    <span className="section-label">SECURE ATTENDANCE</span>
                    <h2>Mark attendance</h2>
                    <p>
                        Identity, location and server time are verified before
                        recording the event.
                    </p>
                </div>

                <div className="security-badge">
                    <span>✓</span>
                    Secure verification
                </div>
            </div>

            <div className="attendance-layout">
                <section className="camera-card">
                    <div className="camera-header">
                        <div>
                            <span className="section-label">BIOMETRIC CAPTURE</span>
                            <h3>Face verification</h3>
                        </div>

                        <span className={`camera-state ${cameraActive ? "ready" : ""}`}>
                            <i />
                            {cameraActive ? "Camera ready" : "Camera off"}
                        </span>
                    </div>

                    <div className="camera-frame">
                        {cameraActive ? (
                            <>
                                <video
    ref={videoRef}
    autoPlay
    muted
    playsInline
    onLoadedMetadata={(e) => {
        e.currentTarget.play().catch((error) => {
            console.error("Camera playback failed:", error);
        });
    }}
    onCanPlay={(e) => {
        e.currentTarget.play().catch((error) => {
            console.error("Camera canPlay playback failed:", error);
        });
    }}
/>
                                <div className="face-guide">
                                    <span />
                                </div>
                                <div className="camera-overlay">
                                    Position your face inside the frame
                                </div>
                            </>
                        ) : (
                            <div className="camera-placeholder">
                                <div className="camera-symbol">◉</div>
                                <strong>Camera is ready when you are</strong>
                                <span>
                                    Your face is captured only for verification.
                                </span>
                                <button
                                    className="primary-button small"
                                    onClick={startCamera}
                                >
                                    Start camera
                                </button>
                            </div>
                        )}
                    </div>

                    <canvas ref={canvasRef} hidden />

                    {cameraActive && (
                        <button className="secondary-button full" onClick={stopCamera}>
                            Turn off camera
                        </button>
                    )}
                </section>

                <section className="attendance-form panel">
                    <div className="form-heading">
                        <span className="section-label">ATTENDANCE EVENT</span>
                        <h3>Employee details</h3>
                    </div>

                    <label>Employee ID</label>
                    <input
                        className="text-input"
                        value={employeeCode}
                        onChange={(e) => setEmployeeCode(e.target.value)}
                        placeholder="e.g. TEST001"
                    />

                    <label>Event type</label>
                    <div className="event-switch">
                        <button
                            className={eventType === "ENTRY" ? "selected" : ""}
                            onClick={() => setEventType("ENTRY")}
                        >
                            <span>↗</span>
                            Entry
                        </button>

                        <button
                            className={eventType === "EXIT" ? "selected" : ""}
                            onClick={() => setEventType("EXIT")}
                        >
                            <span>↙</span>
                            Exit
                        </button>
                    </div>

                    <div className="verification-list">
                        <div className="location-verification">
                            <Verification
                                title="GPS location"
                                status={locationStatus}
                                active={locationStatus === "Location detected"}
                                action={getLocation}
                            />

                            {detectedLocation && (
                                <div className="detected-location">
                                    <strong>✓ {detectedLocation.name}</strong>
                                    <span>
                                        Within approved geofence ·{" "}
                                        {Math.round(detectedLocation.distance)} m
                                    </span>
                                </div>
                            )}
                        </div>

                        <Verification
                            title="Server timestamp"
                            status="Automatic"
                            active
                        />
                    </div>

                    {message && <div className="form-message">{message}</div>}

                    <button
                        className="primary-button attendance-submit"
                        onClick={markAttendance}
                        disabled={loading}
                    >
                        {loading
                            ? "Verifying…"
                            : `Record ${eventType === "ENTRY" ? "entry" : "exit"}`}
                        {!loading && <span>→</span>}
                    </button>

                    <p className="privacy-note">
                        Attendance is recorded with verified identity, location,
                        device information and server time.
                    </p>
                </section>
            </div>
        </div>
    );
}

function EmployeesPage({ onRegisterFace }) {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [employeeCode, setEmployeeCode] = useState("");
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");

    async function loadEmployees() {
        setLoading(true);
        setError("");

        try {
            const response = await fetch(`${API}/api/employees`);
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Unable to load employees.");
            }

            setEmployees(data.employees || []);
        } catch (err) {
            setError(err.message || "Unable to connect to the server.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadEmployees();
    }, []);

    async function handleAddEmployee(event) {
        event.preventDefault();
        setSaving(true);
        setError("");
        setSuccess("");

        try {
            const response = await fetch(`${API}/api/employees`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    employeeCode,
                    fullName,
                    phone,
                }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Unable to add employee.");
            }

            setSuccess("Employee added successfully.");
            setEmployeeCode("");
            setFullName("");
            setPhone("");
            setShowAddForm(false);
            await loadEmployees();
        } catch (err) {
            setError(err.message || "Unable to add employee.");
        } finally {
            setSaving(false);
        }
    }

    function getInitials(name) {
        return name
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0])
            .join("")
            .toUpperCase();
    }

    return (
        <section className="employees-page">
            <div className="page-intro">
                <div>
                    <span className="section-label">WORKFORCE</span>
                    <h2>Employees</h2>
                    <p>
                        Manage employee identities and biometric registration.
                    </p>
                </div>

                <button
                    className="primary-button"
                    onClick={() => {
                        setError("");
                        setSuccess("");
                        setShowAddForm(true);
                    }}
                >
                    + Add employee
                </button>
            </div>

            {error && (
                <div className="employee-alert error" role="alert">
                    {error}
                </div>
            )}

            {success && (
                <div className="employee-alert success" role="status">
                    {success}
                </div>
            )}

            <section className="panel employee-table">
                <div className="table-header">
                    <span>Employee</span>
                    <span>Employee ID</span>
                    <span>Face registration</span>
                    <span>Status</span>
                    <span>Action</span>
                </div>

                {loading ? (
                    <div className="employee-empty">Loading employees…</div>
                ) : employees.length === 0 ? (
                    <div className="employee-empty">
                        No employees added yet. Select “Add employee” to create
                        the first employee record.
                    </div>
                ) : (
                    employees.map((employee) => (
                        <div className="employee-row" key={employee.id}>
                            <div className="employee-name">
                                <div className="employee-avatar">
                                    {getInitials(employee.full_name)}
                                </div>

                                <div>
                                    <strong>{employee.full_name}</strong>
                                    <small>
                                        {employee.phone || "No phone number"}
                                    </small>
                                </div>
                            </div>

                            <span className="mono">
                                {employee.employee_code}
                            </span>

                            <span
                                className={`badge ${
                                    employee.face_registered
                                        ? "success"
                                        : "warning"
                                }`}
                            >
                                {employee.face_registered
                                    ? "✓ Registered"
                                    : "Not registered"}
                            </span>

                            <span
                                className={`badge ${
                                    employee.is_active ? "success" : "warning"
                                }`}
                            >
                                {employee.is_active ? "Active" : "Inactive"}
                            </span>

                            <button
                                className="table-action"
                                onClick={() =>
                                    onRegisterFace({
                                        employeeCode: employee.employee_code,
                                        fullName: employee.full_name,
                                    })
                                }
                            >
                                {employee.face_registered
                                    ? "Update face →"
                                    : "Register face →"}
                            </button>
                        </div>
                    ))
                )}
            </section>

            {showAddForm && (
                <div
                    className="modal-backdrop"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setShowAddForm(false);
                        }
                    }}
                >
                    <section
                        className="registration-modal employee-form-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="add-employee-title"
                    >
                        <div className="registration-header">
                            <div>
                                <span className="section-label">
                                    WORKFORCE
                                </span>
                                <h2 id="add-employee-title">Add employee</h2>
                                <p>Create an employee record before face registration.</p>
                            </div>

                            <button
                                className="modal-close"
                                onClick={() => setShowAddForm(false)}
                                aria-label="Close"
                            >
                                ×
                            </button>
                        </div>

                        <form
                            className="employee-form"
                            onSubmit={handleAddEmployee}
                        >
                            <label htmlFor="new-employee-code">
                                Employee ID
                            </label>
                            <input
                                id="new-employee-code"
                                className="text-input"
                                value={employeeCode}
                                onChange={(event) =>
                                    setEmployeeCode(event.target.value)
                                }
                                placeholder="e.g. EMP003"
                                required
                                maxLength={50}
                            />

                            <label htmlFor="new-employee-name">
                                Full name
                            </label>
                            <input
                                id="new-employee-name"
                                className="text-input"
                                value={fullName}
                                onChange={(event) =>
                                    setFullName(event.target.value)
                                }
                                placeholder="Employee full name"
                                required
                                maxLength={150}
                            />

                            <label htmlFor="new-employee-phone">
                                Phone number <span>(optional)</span>
                            </label>
                            <input
                                id="new-employee-phone"
                                className="text-input"
                                value={phone}
                                onChange={(event) =>
                                    setPhone(event.target.value)
                                }
                                placeholder="Phone number"
                                maxLength={20}
                            />

                            {error && (
                                <div className="employee-alert error">
                                    {error}
                                </div>
                            )}

                            <div className="employee-form-actions">
                                <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={() => setShowAddForm(false)}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="primary-button"
                                    disabled={saving}
                                >
                                    {saving ? "Saving…" : "Create employee"}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </section>
    );
}


function FaceRegistrationModal({
    employee,
    videoRef,
    canvasRef,
    cameraActive,
    startCamera,
    stopCamera,
    registerFace,
    registering,
    message,
    close,
}) {
    const registrationComplete =
        message?.toLowerCase().includes("successfully");

    const captureComplete = registering || registrationComplete;

    return (
        <div className="modal-backdrop">
            <div className="registration-modal">
                <div className="registration-header">
                    <div>
                        <span className="section-label">
                            BIOMETRIC REGISTRATION
                        </span>

                        <h2>Register employee face</h2>

                        <p>
                            {employee.fullName} · {employee.employeeCode}
                        </p>
                    </div>

                    <button className="modal-close" onClick={close}>
                        ×
                    </button>
                </div>

                <div className="registration-body">
                    <div className="registration-camera">
                        {cameraActive ? (
                            <>
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    muted
                                    playsInline
                                />

                                <div className="registration-guide">
                                    <span />
                                </div>

                                <div className="registration-hint">
                                    Keep your face centered
                                </div>
                            </>
                        ) : (
                            <div className="registration-placeholder">
                                <div className="camera-symbol">◉</div>

                                <strong>
                                    Ready for biometric registration
                                </strong>

                                <span>
                                    Use a well-lit environment and look directly
                                    at the camera.
                                </span>

                                <button
                                    className="primary-button small"
                                    onClick={startCamera}
                                    disabled={registrationComplete}
                                >
                                    Start camera
                                </button>
                            </div>
                        )}
                    </div>

                    <canvas ref={canvasRef} hidden />

                    <div className="registration-info">
                        <div
                            className={`registration-step ${
                                cameraActive || captureComplete
                                    ? "complete"
                                    : "active"
                            }`}
                        >
                            <span>
                                {cameraActive || captureComplete ? "✓" : "01"}
                            </span>
                            <div>
                                <strong>Position</strong>
                                <small>Center your face in the guide</small>
                            </div>
                        </div>

                        <div
                            className={`registration-step ${
                                captureComplete
                                    ? "complete"
                                    : cameraActive
                                    ? "active"
                                    : ""
                            }`}
                        >
                            <span>
                                {captureComplete ? "✓" : "02"}
                            </span>
                            <div>
                                <strong>Capture</strong>
                                <small>Create biometric template</small>
                            </div>
                        </div>

                        <div
                            className={`registration-step ${
                                registrationComplete ? "complete" : ""
                            }`}
                        >
                            <span>
                                {registrationComplete ? "✓" : "03"}
                            </span>
                            <div>
                                <strong>Secure</strong>
                                <small>Store the face embedding</small>
                            </div>
                        </div>

                        {message && (
                            <div
                                className={`registration-message ${
                                    registrationComplete ? "success" : ""
                                }`}
                            >
                                {message}
                            </div>
                        )}

                        {cameraActive && !registrationComplete && (
                            <button
                                className="secondary-button full"
                                onClick={stopCamera}
                                disabled={registering}
                            >
                                Turn off camera
                            </button>
                        )}

                        {!registrationComplete && (
                            <button
                                className="primary-button registration-button"
                                onClick={registerFace}
                                disabled={!cameraActive || registering}
                            >
                                {registering
                                    ? "Registering…"
                                    : "Capture & register"}
                                {!registering && <span>→</span>}
                            </button>
                        )}

                        {registrationComplete && (
                            <button
                                className="primary-button registration-button"
                                onClick={close}
                            >
                                Registration complete
                                <span>✓</span>
                            </button>
                        )}

                        <p className="registration-note">
                            The system stores a biometric embedding for
                            verification rather than retaining the captured
                            attendance image.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
function ComingSoon({ title }) {
    return (
        <section className="empty-page panel">
            <span className="section-label">PRECIS PLATFORM</span>
            <h2>{title}</h2>
            <p>
                This module is being prepared for the next phase of the
                Foundry Management System.
            </p>
        </section>
    );
}

function Metric({ label, value, change, description }) {
    return (
        <div className="metric-card">
            <div className="metric-top">
                <span>{label}</span>
                <span className="metric-change">{change}</span>
            </div>
            <strong>{value}</strong>
            <small>{description}</small>
        </div>
    );
}

function AttendanceRow({ name, id, type, time }) {
    return (
        <div className="attendance-row">
            <div className="employee-name">
                <div className="employee-avatar">{name.slice(-2)}</div>
                <div>
                    <strong>{name}</strong>
                    <small>{id}</small>
                </div>
            </div>

            <span className={`event-badge ${type.toLowerCase()}`}>
                {type}
            </span>

            <span className="row-time">{time}</span>
        </div>
    );
}

function StatusItem({ label }) {
    return (
        <div className="status-item">
            <span className="status-check">✓</span>
            <span>{label}</span>
            <strong>Operational</strong>
        </div>
    );
}

function Verification({ title, status, active, action }) {
    return (
        <div className="verification">
            <div className={`verification-icon ${active ? "active" : ""}`}>
                {active ? "✓" : "•"}
            </div>

            <div>
                <strong>{title}</strong>
                <span>{status}</span>
            </div>

            {action && status !== "Location detected" && (
                <button onClick={action}>Detect</button>
            )}
        </div>
    );
}

export default App;
