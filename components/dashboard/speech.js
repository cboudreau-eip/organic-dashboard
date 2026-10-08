const messages = [
  'Get back to work!',
  "What ya' looking at?",
  "What's brown and sticky? A stick!",
];

export function startPortraitSpeech(button) {
  if (!button) return () => {};
  const text = button.querySelector('span');
  const presence = button.closest('.charlie-presence');
  const portrait = presence?.querySelector('.portrait-stage') || presence?.querySelector('img');
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
      index = (index + 1) % messages.length;
      text.textContent = messages[index];
      showNextPose();
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
  button.addEventListener('click', toggle);
  start();
  return () => {
    clearInterval(timer);
    button.removeEventListener('click', toggle);
    portrait?.removeEventListener('animationend', finishWiggle);
    portrait?.classList.remove('is-speaking');
    presence?.classList.remove('motion-paused');
  };
}
