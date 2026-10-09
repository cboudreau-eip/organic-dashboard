const messages = [
  'Get back to work!',
  "What ya' looking at?",
  "What's brown and sticky? A stick!",
];

const poseMessages = {
  'portrait-kick': 'Kapow!!!',
  'portrait-dancing': 'These numbers got me dancing!',
  'portrait-swole': 'Check out these gains!',
  'portrait-guitar': 'Let’s rock these rankings!',
  'portrait-horse': 'Saddle up! We’ve got leads to chase!',
};

export function startPortraitSpeech(button) {
  if (!button) return () => {};
  const text = button.querySelector('span');
  const presence = button.closest('.charlie-presence');
  const portrait = presence?.querySelector('.portrait-stage') || presence?.querySelector('img');
  const dock = presence?.closest('.charlie-dock');
  const restoreButton = dock?.querySelector('.charlie-restore');
  const launcher = dock?.querySelector('.chat-launcher');
  const storageKey = 'organic-charlie-hidden';
  const rememberHidden = hidden => {
    try { button.ownerDocument.defaultView.localStorage.setItem(storageKey, String(hidden)); } catch { /* Still works when browser storage is unavailable. */ }
  };
  try { if (presence) presence.hidden = button.ownerDocument.defaultView.localStorage.getItem(storageKey) === 'true'; } catch {}
  if (restoreButton) restoreButton.hidden = !presence?.hidden;
  const poses = [...(presence?.querySelectorAll('.portrait-pose') || [])];
  let poseIndex = 0;
  const showNextPose = () => {
    if (poses.length < 2) return;
    const next = (poseIndex + 1) % poses.length;
    // Retain the current pose if another asset is still loading or failed.
    if (!poses[next].complete || !poses[next].naturalWidth) return;
    poses[poseIndex].classList.remove('is-active');
    poses[next].classList.add('is-active');
    poseIndex = next;
  };
  const finishWiggle = event => {
    if (event.animationName === 'charlie-wiggle') portrait?.classList.remove('is-speaking');
  };
  portrait?.addEventListener('animationend', finishWiggle);
  let index = 0;
  let paused = false;
  let timer;
  text.textContent = messages[index];
  const start = () => {
    timer = setInterval(() => {
      showNextPose();
      const poseMessage = Object.entries(poseMessages).find(([className]) => poses[poseIndex]?.classList.contains(className));
      if (!poseMessage) index = (index + 1) % messages.length;
      text.textContent = poseMessage ? poseMessage[1] : messages[index];
      portrait?.classList.add('is-speaking');
    }, 10000);
  };
  const toggle = () => {
    paused = !paused;
    presence?.classList.toggle('motion-paused', paused);
    portrait?.classList.remove('is-speaking');
    clearInterval(timer);
    button.setAttribute('aria-pressed', String(paused));
    button.setAttribute('aria-label', `${paused ? 'Resume' : 'Pause'} Charlie's speech and poses`);
    if (!paused) start();
  };
  const dismiss = () => {
    clearInterval(timer);
    presence.hidden = true;
    rememberHidden(true);
    if (restoreButton) restoreButton.hidden = false;
    launcher?.focus();
  };
  const restore = () => {
    presence.hidden = false;
    rememberHidden(false);
    if (restoreButton) restoreButton.hidden = true;
    if (launcher?.getAttribute('aria-expanded') === 'true') launcher.click();
    clearInterval(timer);
    if (!paused) start();
    portrait?.focus();
  };
  restoreButton?.addEventListener('click', restore);
  portrait?.addEventListener('click', dismiss);
  button.addEventListener('click', toggle);
  if (!presence?.hidden) start();
  return () => {
    clearInterval(timer);
    button.removeEventListener('click', toggle);
    portrait?.removeEventListener('click', dismiss);
    restoreButton?.removeEventListener('click', restore);
    portrait?.removeEventListener('animationend', finishWiggle);
    portrait?.classList.remove('is-speaking');
    presence?.classList.remove('motion-paused');
  };
}
