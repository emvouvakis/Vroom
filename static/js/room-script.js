// Get roomHash
const roomHash = window.room_hash
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

function setupWebSocket() {
    ws = new WebSocket(`ws://${location.host}/ws/${roomHash}`);

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

    ws.onmessage = function(event) {
        const chatLog = document.getElementById("chat-log");
        const parsedData = JSON.parse(event.data);
        const message = document.createElement("div");
        const usernameBox = document.createElement("div");
        const messageText = document.createElement("p");
        const timestamp = document.createElement("div");

        // Convert UTC timestamp to local time and format
        const localTime = formatDate(parsedData.timestamp);

        console.log(parsedData.username)

        // Determine if the message is from the current user
        const isCurrentUser = parsedData.username === username;

        // Add appropriate class for alignment
        message.className = isCurrentUser ? "message current-user" : "message other-user";
        
        usernameBox.className = "username";
        usernameBox.textContent = parsedData.username;

        messageText.className = "message-text";
        messageText.textContent = parsedData.text;

        timestamp.className = "timestamp";
        timestamp.textContent = localTime;

        message.appendChild(usernameBox);
        message.appendChild(messageText);
        message.appendChild(timestamp);
        chatLog.appendChild(message);
        chatLog.scrollTop = chatLog.scrollHeight; // Auto-scroll to bottom

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

document.getElementById("send-btn").onclick = function() {
    const input = document.getElementById("chat-input");
    const messageText = input.value.trim();
    if (messageText && ws.readyState === WebSocket.OPEN) {
        const message = JSON.stringify({
            type: 'message',
            text: messageText
        });
        ws.send(message);
        input.value = "";
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
    window.location.href = `http://${location.host}`; // Redirect to the homepage
});
