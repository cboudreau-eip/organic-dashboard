const messages = [
  'Get back to work!',
  "What ya' looking at?",
  "What's brown and sticky? A stick!",
];

export function startPortraitSpeech(button) {
  if (!button) return () => {};
  const text = button.querySelector('span');
  let index = 0;
  let paused = false;
  let timer;
  text.textContent = messages[index];
  const start = () => {
    timer = setInterval(() => {
      index = (index + 1) % messages.length;
      text.textContent = messages[index];
    }, 10000);
  };
  const toggle = () => {
    paused = !paused;
    clearInterval(timer);
    button.setAttribute('aria-pressed', String(paused));
    button.setAttribute('aria-label', `${paused ? 'Resume' : 'Pause'} Charlie's speech bubble`);
    if (!paused) start();
  };
  button.addEventListener('click', toggle);
  start();
  return () => {
    clearInterval(timer);
    button.removeEventListener('click', toggle);
  };
}
