// Вшитый твой Discord ID
const DISCORD_ID = "1103000049031594024";

// 1. АНИМАЦИЯ СНЕГА НА ФОНЕ
const canvas = document.getElementById('snowfall');
const ctx = canvas.getContext('2d');

let width = canvas.width = window.innerWidth;
let height = canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
});

const flakes = [];
for (let i = 0; i < 45; i++) {
    flakes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 2 + 1,
        speed: Math.random() * 0.8 + 0.3,
        opacity: Math.random() * 0.6 + 0.2
    });
}

function drawSnow() {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";

    flakes.forEach(flake => {
        ctx.beginPath();
        ctx.globalAlpha = flake.opacity;
        ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
        ctx.fill();

        flake.y += flake.speed;
        if (flake.y > height) {
            flake.y = 0;
            flake.x = Math.random() * width;
        }
    });

    requestAnimationFrame(drawSnow);
}
drawSnow();


// 2. ОПРЕДЕЛЕНИЕ И ОТОБРАЖЕНИЕ АКТИВНОСТИ DISCORD
function updateDiscordStatus() {
    fetch(`https://api.lanyard.rest/v1/users/${DISCORD_ID}`)
        .then(res => res.json())
        .then(res => {
            if (!res.success) return;

            const data = res.data;
            const status = data.discord_status;

            // Обновляем статус-точки (зеленая/красная/серый кружок)
            const dots = [document.getElementById('status-dot'), document.getElementById('dc-card-status')];
            dots.forEach(dot => {
                if (dot) dot.className = `status-dot ${status}`;
            });

            // Ставим настоящую аватарку Discord
            if (data.discord_user.avatar) {
                const avatarUrl = `https://cdn.discordapp.com/avatars/${DISCORD_ID}/${data.discord_user.avatar}.png?size=256`;
                document.getElementById('discord-avatar').src = avatarUrl;
                document.getElementById('dc-card-avatar').src = avatarUrl;
            }

            // Никнейм
            const displayName = data.discord_user.global_name || data.discord_user.username;
            document.getElementById('dc-card-username').innerText = displayName;

            // Логика текста активности (как на fakecrime)
            const activityText = document.getElementById('dc-card-activity');

            if (status === 'offline') {
                activityText.innerText = 'Не в сети';
                return;
            }

            if (data.activities && data.activities.length > 0) {
                const customStatus = data.activities.find(a => a.type === 4); // Пользовательский статус ("анальный ползун" и т.д.)
                const playingGame = data.activities.find(a => a.type === 0);  // Игра

                if (customStatus && customStatus.state) {
                    activityText.innerText = customStatus.state;
                } else if (playingGame) {
                    activityText.innerText = `Играет в ${playingGame.name}`;
                } else {
                    activityText.innerText = 'В сети';
                }
            } else {
                activityText.innerText = 'В сети';
            }
        })
        .catch(err => {
            console.error("Ошибка получения статуса:", err);
            document.getElementById('dc-card-activity').innerText = 'Не в сети';
        });
}

// Запускаем при открытии страницы
updateDiscordStatus();
// И обновляем каждые 8 секунд
setInterval(updateDiscordStatus, 8000);