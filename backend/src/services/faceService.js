const axios = require("axios");

const FACE_SERVICE_URL = (
    process.env.FACE_SERVICE_URL || "http://127.0.0.1:5100"
).replace(/\/+$/, "");

const REQUEST_TIMEOUT_MS = 90000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [3000, 8000];

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(error) {
    const status = error.response?.status;

    // Retry network errors/timeouts and temporary upstream/server failures.
    // Do not retry normal client errors such as invalid image data (400).
    return (
        !error.response ||
        status === 429 ||
        status === 502 ||
        status === 503 ||
        status === 504
    );
}

async function postToFaceService(endpoint, payload) {
    let lastError;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
            const response = await axios.post(
                `${FACE_SERVICE_URL}/${endpoint}`,
                payload,
                { timeout: REQUEST_TIMEOUT_MS }
            );

            return response.data;
        } catch (error) {
            lastError = error;

            if (!isRetryable(error) || attempt === MAX_ATTEMPTS) {
                break;
            }

            const delay = RETRY_DELAYS_MS[attempt - 1] || 8000;

            // Log only retry metadata. Never log face images or embeddings.
            console.warn("Face service request will retry:", {
                endpoint,
                attempt,
                nextAttempt: attempt + 1,
                delayMs: delay,
                status: error.response?.status || null,
                code: error.code || null,
            });

            await sleep(delay);
        }
    }

    throw lastError;
}

async function registerFace(image) {
    return postToFaceService("register", { image });
}

async function verifyFace(image, embedding) {
    return postToFaceService("verify", {
        image,
        embedding,
    });
}

module.exports = {
    registerFace,
    verifyFace,
};
