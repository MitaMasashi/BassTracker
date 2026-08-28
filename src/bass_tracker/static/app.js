const screens = document.querySelectorAll('.screen');
const navItems = document.querySelectorAll('.nav-item');

function showScreen(id) {
  screens.forEach((screen) => screen.classList.toggle('active', screen.id === id));
  navItems.forEach((item) => item.classList.toggle('active', item.dataset.screen === id));
}

navItems.forEach((item) => item.addEventListener('click', () => showScreen(item.dataset.screen)));
document.querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => showScreen(button.dataset.go)));

document.querySelectorAll('[data-import]').forEach((tab) => tab.addEventListener('click', () => {
  document.querySelectorAll('[data-import]').forEach((item) => item.classList.toggle('active', item === tab));
  document.getElementById('local-fields').hidden = tab.dataset.import !== 'local';
  document.getElementById('youtube-fields').hidden = tab.dataset.import !== 'youtube';
}));

document.getElementById('import-form').addEventListener('submit', (event) => {
  event.preventDefault();
  document.getElementById('import-message').textContent = '登録・解析処理は未実装です。ImportServiceの実装でこのフォームを接続します。';
});
