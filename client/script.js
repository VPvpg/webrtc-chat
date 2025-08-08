const chat = document.getElementById("chat");
const messageInput = document.getElementById("message");
const sendBtn = document.getElementById("sendBtn");

// список бесплатных STUN/TURN (с приоритетом)
const iceServersList = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    // бесплатный TURN Viagenie (ограниченный)
    {
        urls: "turn:numb.viagenie.ca",
        username: "webrtc@live.com",
        credential: "muazkh"
    }
];

let pc, dataChannel, ws;

function log(msg) {
    chat.value += msg + "\n";
}

// === УСТАНОВКА P2P соединения ===
async function initConnection() {
    pc = new RTCPeerConnection({ iceServers: iceServersList });

    dataChannel = pc.createDataChannel("chat");
    dataChannel.onmessage = e => log("Собеседник: " + e.data);

    // ICE кандидаты — отправляем на сигнальный сервер
    pc.onicecandidate = event => {
        if (event.candidate) {
            ws.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
        }
    };

    // Сообщение при получении канала
    pc.ondatachannel = e => {
        e.channel.onmessage = ev => log("Собеседник: " + ev.data);
    };

    // Создаём оффер и отправляем
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: "offer", offer }));
}

// === КНОПКА ОТПРАВКИ ===
sendBtn.onclick = () => {
    const msg = messageInput.value;
    if (msg && dataChannel && dataChannel.readyState === "open") {
        dataChannel.send(msg);
        log("Вы: " + msg);
        messageInput.value = "";
    }
};

// === ПОДКЛЮЧЕНИЕ К СИГНАЛЬНОМУ СЕРВЕРУ ===
function connectSignaling(roomId) {
    // сюда вставь адрес своего бесплатного сервера (Heroku/Render)
    ws = new WebSocket("wss://YOUR-FREE-SIGNAL-SERVER-APP.herokuapp.com/" + roomId);

    ws.onopen = () => {
        log("Подключились к комнате: " + roomId);
        initConnection();
    };

    ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: "answer", answer }));
        } else if (data.type === "answer") {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        } else if (data.type === "candidate") {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (e) {
                console.error("Ошибка ICE:", e);
            }
        }
    };
}

// === ЗАПУСК ===
// Чтобы два игрока встретились, нужно, чтобы они ввели одинаковое имя комнаты в prompt
const room = prompt("Введите название комнаты:");
connectSignaling(room);
