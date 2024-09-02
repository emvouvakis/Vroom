const createRoomTab = document.getElementById("create-room-tab");
const joinRoomTab = document.getElementById("join-room-tab");
const createRoomForm = document.getElementById("create-room-form");
const joinRoomForm = document.getElementById("join-room-form");

createRoomTab.addEventListener("click", function() {
    createRoomForm.style.display = "block";
    joinRoomForm.style.display = "none";
    createRoomTab.classList.add("active");
    joinRoomTab.classList.remove("active");
    createRoomTab.focus(); // Optional: Set focus to the active tab
});

joinRoomTab.addEventListener("click", function() {
    joinRoomForm.style.display = "block";
    createRoomForm.style.display = "none";
    joinRoomTab.classList.add("active");
    createRoomTab.classList.remove("active");
    joinRoomTab.focus(); // Optional: Set focus to the active tab
});

// Handle error messages from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const error = urlParams.get('error');
if (error) {
    document.getElementById("error-message").textContent = decodeURIComponent(error);
}

// Store data in sessionStorage when the form is submitted
document.getElementById("create-form").addEventListener("submit", function(event) {
    const username = document.getElementById("create-username").value;
    const password = document.getElementById("create-password").value;
    sessionStorage.setItem("username", username);
    sessionStorage.setItem("password", password);
});

document.getElementById("join-form").addEventListener("submit", function(event) {
    const username = document.getElementById("join-username").value;
    const password = document.getElementById("join-password").value;
    sessionStorage.setItem("username", username);
    sessionStorage.setItem("password", password);
});
