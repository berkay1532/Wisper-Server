const socket = io("http://localhost:8080"); // Socket sunucusuna bağlan

let chatId = "";
let pubkey = "";
let receiverPubkey = "";

const chatDiv = document.getElementById("chat");
const form = document.getElementById("message-form");
const input = document.getElementById("message");

var typingIndicator = document.getElementById("typing");

const chatInfo = document.getElementById("chatInfo");

const receiverStatus = document.getElementById("receiverStatus");

const chatIdCopy = document.getElementById("chatIdCopy");
chatIdCopy.onclick = function () {
  navigator.clipboard.writeText(chatId);
};

// Handle typing event
input.addEventListener("input", function (value) {
  if (!!input.value) {
    socket.emit("typing", chatId, pubkey);
  } else {
    socket.emit("stop typing", chatId);
  }
});

socket.on("user typing", (user) => {
  typingIndicator.textContent = user + " is typing...";
});

socket.on("user stopped typing", () => {
  typingIndicator.textContent = "";
});

// Mesaj gönderme işlemi
form.addEventListener("submit", function (e) {
  e.preventDefault(); // Sayfa yenilenmesini engelle
  if (input.value && chatId) {
    const message = input.value;

    // Mesajı ekranında sağda göster (kendi mesajı)
    addMessage(`You: ${message}`, "sent");

    // Mesajı belirli bir chat ID'siyle sunucuya gönder
    socket.emit("send message", {
      chatId,
      message,
      receiverPk: receiverPubkey,
    });

    input.value = ""; // Mesaj kutusunu temizle

    socket.emit("stop typing", chatId);
  }
});

// Katılım hatası dinleyicisi
socket.on("join error", (message) => {
  console.log(message); // Hata mesajını göster
});

// Çevrimiçi kullanıcı bildirimi
socket.on("user online", (pubkey) => {
  receiverStatus.textContent = `User ${pubkey} is online.`;
});

// Çevrimdışı kullanıcı bildirimi
socket.on("user offline", (pubkey) => {
  receiverStatus.textContent = `User ${pubkey} is offline.`;
});

// Çevrimiçi kullanıcıları göster
socket.on("online users", (onlineUsers) => {
  console.log("Online users:", onlineUsers);
  const receiverPubkey = onlineUsers.find((user) => {
    return user !== pubkey;
  });

  console.log("Receiver pubkey:", receiverPubkey);

  if (receiverPubkey) {
    receiverStatus.textContent = `User ${receiverPubkey} is online.`;
  }
});

// Sunucudan gelen mesajları dinle ve ekranda solda göster (diğer kişinin mesajı)
socket.on("receive message", (message) => {
  addMessage(`Friend: ${message}`, "received");
});

socket.on("chat created", (data) => {
  console.log("Chat created:", data);
  chatId = data.chatId;
  receiverPubkey = data.receiverPubkey;
  modal.style.display = "none"; // Modalı kapat
  chatInfo.querySelector(
    "#publicKeyDisplay"
  ).textContent = `Your Public Key: ${pubkey}`;
  chatInfo.querySelector("#chatIdDisplay").textContent = `Chat ID: ${chatId}`;
  socket.emit("join chat", chatId, pubkey);
});

// Mesajı chat ekranına ekle
function addMessage(message, type) {
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message");
  messageDiv.classList.add(type);

  const messageContent = document.createElement("div");
  messageContent.classList.add("message-content");
  messageContent.textContent = message;

  messageDiv.appendChild(messageContent);
  chatDiv.appendChild(messageDiv);
  chatDiv.scrollTop = chatDiv.scrollHeight; // Mesaj kutusunu en alta kaydır
}

// Modal işlemleri
const modal = document.getElementById("modal");
const closeModal = document.getElementById("closeModal");

const pubkeyInput = document.getElementById("pubkey");
const chatIdInput = document.getElementById("chatId");
const receiverPubkeyInput = document.getElementById("receiverPubkey");

const joinChatSection = document.getElementById("joinChatSection");
const createChatSection = document.getElementById("createChatSection");

const joinChatButton = document.getElementById("joinChatButton");
const createChatButton = document.getElementById("createChatButton");
const confirmJoinButton = document.getElementById("confirmJoinButton");
const confirmCreateButton = document.getElementById("confirmCreateButton");

// Modalı aç
modal.style.display = "block";

// Modal kapama butonuna tıklandığında
closeModal.onclick = function () {
  modal.style.display = "none";
};

// "Join Chat" butonuna basıldığında
joinChatButton.onclick = function () {
  joinChatSection.style.display = "block";
  joinChatButton.style.display = "none";
  createChatButton.style.display = "none";
  createChatSection.style.display = "none";
};

// "Create Chat" butonuna basıldığında
createChatButton.onclick = function () {
  createChatSection.style.display = "block";
  joinChatButton.style.display = "none";
  createChatButton.style.display = "none";
  joinChatSection.style.display = "none";
};

// "Join Chat" onayı
confirmJoinButton.onclick = function () {
  pubkey = pubkeyInput.value;
  chatId = chatIdInput.value;

  if (pubkey && chatId) {
    // Socket'e katılma talebi gönder
    socket.emit("join chat", chatId, pubkey);
    modal.style.display = "none"; // Modalı kapat
    chatInfo.querySelector(
      "#publicKeyDisplay"
    ).textContent = `Your Public Key: ${pubkey}`;
    chatInfo.querySelector("#chatIdDisplay").textContent = `Chat ID: ${chatId}`;
  } else {
    alert("Please fill in all fields.");
  }
};

// "Create Chat" onayı
confirmCreateButton.onclick = function () {
  pubkey = pubkeyInput.value;
  receiverPubkey = receiverPubkeyInput.value;

  if (pubkey && receiverPubkey) {
    // Oluşturulan chat ID ile sohbete katıl
    socket.emit("create chat", pubkey, receiverPubkey);
    socket.emit("join chat", chatId, pubkey);
  } else {
    alert("Please fill in all fields.");
  }
};
