// Get roomHash
const roomHash = window.room_hash;
let ws;
let username;

// JavaScript to handle copy-to-clipboard
document.getElementById('copy-btn').addEventListener('click', function() {
    const roomId = document.getElementById('room-id').textContent;

    // Attempt to use the Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(roomId)
            .then(() => showCopyFeedback())
            .catch(err => console.error("Failed to copy:", err));
    } else {
        // Fallback method for older or unsupported browsers
        const textArea = document.createElement("textarea");
        textArea.value = roomId;
        textArea.style.position = "fixed";  // Avoid scrolling to bottom of the page in mobile devices
        textArea.style.opacity = "0"; // Make it invisible

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            const successful = document.execCommand('copy');
            if (successful) {
                showCopyFeedback();
            } else {
                console.error("Fallback: Copy command was unsuccessful");
            }
        } catch (err) {
            console.error("Fallback: Oops, unable to copy", err);
        }

        document.body.removeChild(textArea);
    }
});

function showCopyFeedback() {
    const copyBtn = document.getElementById('copy-btn');
    copyBtn.innerHTML = '<i class="fa fa-check"></i>';  // Change icon to a checkmark

    // Optionally, you can change the color of the button as well
    copyBtn.style.color = 'green';

    // Revert to original after a short delay
    setTimeout(() => {
        copyBtn.innerHTML = '<i class="fa fa-copy"></i>'; // Revert icon back to copy
        copyBtn.style.color = '#007bff'; // Reset color
    }, 1500);
}

// Image send button logic
document.getElementById('image-btn').addEventListener('click', function() {
    document.getElementById('image-input').click();
});

// Camera button logic
document.getElementById('camera-btn').addEventListener('click', function() {
    // Create a modal for camera preview and capture
    const cameraModal = document.createElement('div');
    cameraModal.id = 'camera-modal';

    // Video element for live preview
    const video = document.createElement('video');
    video.autoplay = true;

    // Capture button
    const captureBtn = document.createElement('button');
    captureBtn.textContent = 'Capture';

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';

    // Button container
    const btnContainer = document.createElement('div');
    btnContainer.className = 'camera-btn-container';
    btnContainer.appendChild(captureBtn);
    btnContainer.appendChild(cancelBtn);

    // Modal content
    const content = document.createElement('div');
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.alignItems = 'center';
    content.appendChild(video);
    content.appendChild(btnContainer);

    cameraModal.appendChild(content);
    document.body.appendChild(cameraModal);

    // Access the camera
    let stream;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(s => {
            stream = s;
            video.srcObject = stream;
        })
        .catch(err => {
            alert('Could not access camera: ' + err);
            document.body.removeChild(cameraModal);
        });

    // Capture logic
    captureBtn.onclick = async function() {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64Image = canvas.toDataURL('image/png');

        // Stop the camera
        stream.getTracks().forEach(track => track.stop());
        document.body.removeChild(cameraModal);

        // Encrypt and send the image
        const password = sessionStorage.getItem("password");
        const { encryptedMessage, iv } = await encryptMessage(base64Image, password, roomHash);

        const message = JSON.stringify({
            type: 'image',
            text: [...iv, ...encryptedMessage],
        });

        ws.send(message);
    };

    // Cancel logic
    cancelBtn.onclick = function() {
        if (stream) stream.getTracks().forEach(track => track.stop());
        document.body.removeChild(cameraModal);
    };
});

// Handle image selection/capture
document.getElementById('image-input').addEventListener('change', async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64Image = e.target.result;
        const password = sessionStorage.getItem("password");
        const { encryptedMessage, iv } = await encryptMessage(base64Image, password, roomHash);

        const message = JSON.stringify({
            type: 'image',
            text: [...iv, ...encryptedMessage], // Send IV + Encrypted image data
        });

        ws.send(message);
    };
    reader.readAsDataURL(file);
});

// Add a Record button
const recordBtn = document.createElement('button');
recordBtn.id = 'record-btn';
recordBtn.title = 'Record Audio';
recordBtn.innerHTML = '<i class="fa fa-microphone"></i>';
document.getElementById('send-btn').before(recordBtn);

let mediaRecorder;
let audioChunks = [];
let isRecording = false;

recordBtn.addEventListener('click', async function() {
    if (!isRecording) {
        // Start recording
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('Audio recording not supported in this browser.');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = e => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onloadend = async function() {
                    const base64Audio = reader.result; // Data URL
                    const password = sessionStorage.getItem("password");
                    const { encryptedMessage, iv } = await encryptMessage(base64Audio, password, roomHash);
                    const message = JSON.stringify({
                        type: 'audio',
                        text: [...iv, ...encryptedMessage],
                    });
                    ws.send(message);
                };
                reader.readAsDataURL(audioBlob);
            };
            mediaRecorder.start();
            isRecording = true;
            recordBtn.innerHTML = '<i class="fa fa-stop"></i>';
        } catch (err) {
            alert('Could not access microphone: ' + err);
        }
    } else {
        // Stop recording
        mediaRecorder.stop();
        isRecording = false;
        recordBtn.innerHTML = '<i class="fa fa-microphone"></i>';
    }
});

function setupWebSocket() {
    ws = new WebSocket(`ws://${location.host}/ws/${roomHash}`);

    // Load the sound file
    const notificationSound = new Audio(`https://${location.host}/static/mp3/message-notification.mp3`);

    ws.onopen = function() {
        console.log("Connected to WebSocket.");

        // Check sessionStorage for saved credentials
        let password = sessionStorage.getItem("password");
        username = sessionStorage.getItem("username");

        // If not found in sessionStorage, redirect to the homepage
        if (!password || !username) {
            window.location.href = `http://${location.host}`; // Redirect to the homepage
            return; // Exit the function to prevent further execution
        }

        const authData = JSON.stringify({ password, username });
        ws.send(authData);
        updateUserList();
    };

    function formatDate(utcTimestamp) {
        const date = new Date(utcTimestamp);

        // Format the date part (dd/mm/yy)
        const dateOptions = { day: '2-digit', month: '2-digit', year: '2-digit' };
        const datePart = date.toLocaleDateString('en-GB', dateOptions);

        // Format the time part (hh:mm)
        const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
        const timePart = date.toLocaleTimeString('en-GB', timeOptions);

        // Combine both parts
        return `${datePart} ${timePart}`;
    }

    ws.onmessage = async function(event) {
        const chatLog = document.getElementById("chat-log");
        const parsedData = JSON.parse(event.data);
        const message = document.createElement("div");
        const usernameBox = document.createElement("div");
        const messageText = document.createElement("p");
        const timestamp = document.createElement("div");

        // --- FIX: Ensure encryptedData is always an array ---
        let encryptedData = parsedData.text;
        if (typeof encryptedData === "string") {
            try {
                encryptedData = JSON.parse(encryptedData);
            } catch (e) {
                // fallback: leave as is
            }
        }

        // Decrypt the message
        const decryptedMessage = await decryptMessage(encryptedData, sessionStorage.getItem("password"), roomHash);

        // Convert UTC timestamp to local time and format
        const localTime = formatDate(parsedData.timestamp);

        // Determine if the message is from the current user
        const isCurrentUser = parsedData.username === username;

        // Add appropriate class for alignment
        message.className = isCurrentUser ? "message current-user" : "message other-user";
        
        usernameBox.className = "username";
        usernameBox.textContent = parsedData.username;

        messageText.className = "message-text";

        // Check if it's an audio message
        if (parsedData.type === 'audio') {
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.src = decryptedMessage;
            messageText.appendChild(audio);
        } else if (parsedData.type === 'image') {
            const img = document.createElement('img');
            img.src = decryptedMessage;
            img.style.maxWidth = '200px';
            img.style.maxHeight = '200px';
            messageText.appendChild(img);
        } else {
            messageText.textContent = decryptedMessage; // Show decrypted message
        }

        timestamp.className = "timestamp";
        timestamp.textContent = localTime;

        message.appendChild(usernameBox);
        message.appendChild(messageText);
        message.appendChild(timestamp);
        chatLog.appendChild(message);
        chatLog.scrollTop = chatLog.scrollHeight; // Auto-scroll to bottom

        // Play notification sound when receiving a message
        if (!isCurrentUser) {
            notificationSound.play();
        }

        updateUserList();
    };

    ws.onerror = function(event) {
        console.error("WebSocket error:", event);
        displayError("WebSocket error. Please try again later.");
    };

    ws.onclose = function(event) {
        console.log("WebSocket closed:", event);
        displayError("WebSocket connection closed.");

        // Handle the close event, e.g., by displaying a message to the user
        if (!event.wasClean) {
            console.error(`Connection closed unexpectedly. Code: ${event.code}, Reason: ${event.reason}`);
        }
    };
}

function displayError(message) {
    const errorMessageDiv = document.getElementById("error-message");
    errorMessageDiv.textContent = message;
}

// Function to encrypt messages
async function encryptMessage(message, password, salt) {
    const encoder = new TextEncoder();
    const passwordKey = await window.crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    const saltBuffer = encoder.encode(salt);
    const keyMaterial = await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: saltBuffer,
            iterations: 100000,
            hash: "SHA-256",
        },
        passwordKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt"]
    );

    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // Initialization vector
    const encryptedMessage = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv,
        },
        keyMaterial,
        encoder.encode(message)
    );

    // Return the encrypted message as an ArrayBuffer along with the IV
    return { encryptedMessage: Array.from(new Uint8Array(encryptedMessage)), iv: Array.from(iv) };
}

// Function to decrypt messages
async function decryptMessage(encryptedData, password, salt) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const passwordKey = await window.crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    const saltBuffer = encoder.encode(salt);
    const keyMaterial = await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: saltBuffer,
            iterations: 100000,
            hash: "SHA-256",
        },
        passwordKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
    );

    const encryptedArray = Uint8Array.from(encryptedData);
    const iv = encryptedArray.slice(0, 12); // Extract IV from the message
    const encryptedMessage = encryptedArray.slice(12); // Extract encrypted message

    try {
        const decryptedMessage = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv,
            },
            keyMaterial,
            encryptedMessage
        );

        return decoder.decode(decryptedMessage);
    } catch (err) {
        console.error("Decryption failed:", err);
        return "Decryption error"; // Return an error message
    }
}

document.getElementById("send-btn").onclick = async function() {
    const input = document.getElementById("chat-input");
    const messageText = input.value.trim();

    if (messageText && ws.readyState === WebSocket.OPEN) {
        const password = sessionStorage.getItem("password");
        const { encryptedMessage, iv } = await encryptMessage(messageText, password, roomHash);
        
        const message = JSON.stringify({
            type: 'message',
            text: [...iv, ...encryptedMessage], // Send IV + Encrypted message
        });
        
        ws.send(message);
        input.value = ""; // Clear the input field
    } else {
        displayError("Cannot send an empty message or WebSocket is not open.");
    }
};

document.getElementById("chat-input").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        document.getElementById("send-btn").click();
        event.preventDefault();
    }
});

document.addEventListener('DOMContentLoaded', function() {
    setupWebSocket();
});

// Fetch and display connected users
async function updateUserList() {
    try {
        const response = await fetch(`/room/${roomHash}/users`);
        const data = await response.json();
        const userList = data.users;
        
        const userListDiv = document.getElementById("user-list");
        userListDiv.innerHTML = ""; // Clear existing list
        
        userList.forEach(user => {
            const userItem = document.createElement("p");
            userItem.textContent = user;
            userListDiv.appendChild(userItem);
        });
    } catch (error) {
        console.error('Failed to fetch user list:', error);
    }
}

// Ensure the sidebar is hidden initially using JavaScript
document.getElementById('user-list-container').style.display = 'none';
document.getElementById('toggle-sidebar').addEventListener('click', function() {
    const userListContainer = document.getElementById('user-list-container');
    
    // Check the current display state and toggle it
    if (userListContainer.style.display == 'none') {
        userListContainer.style.display = 'block';
        this.textContent = '←'; // Change button text to indicate closing
    } else {
        userListContainer.style.display = 'none';
        this.textContent = '☰'; // Change button text to indicate opening
    }
});

document.getElementById('logout-btn').addEventListener('click', function() {
    // Clear session storage and redirect to login page

    sessionStorage.clear();
    window.location.href = `https://${location.host}`; // Redirect to the homepage
});

// Image modal logic
const imageModal = document.createElement('div');
imageModal.id = 'image-modal';
imageModal.style.display = 'none';
imageModal.style.position = 'fixed';
imageModal.style.zIndex = '1000';
imageModal.style.left = '0';
imageModal.style.top = '0';
imageModal.style.width = '100vw';
imageModal.style.height = '100vh';
imageModal.style.background = 'rgba(0,0,0,0.8)';
imageModal.style.alignItems = 'center';
imageModal.style.justifyContent = 'center';
imageModal.innerHTML = '<img id="modal-img" src="" style="max-width:90vw; max-height:90vh; border-radius:8px;">';
document.body.appendChild(imageModal);

const modalImg = imageModal.querySelector('#modal-img'); // Always get from modal

// Close modal on click
imageModal.onclick = function() {
    imageModal.style.display = 'none';
    modalImg.src = '';
};

// Delegate click event for images in chat
document.getElementById("chat-log").addEventListener("click", function(event) {
    if (event.target.tagName === 'IMG') {
        modalImg.src = event.target.src;
        imageModal.style.display = 'flex';
    }
});
