// This page is a UI preview, not an authentication or authorization boundary.
// Wire an Entra-backed server session before adding private data.
document.getElementById('microsoft-signin').addEventListener('click', () => {
  const status = document.getElementById('login-status');
  status.hidden = false;
  status.textContent = 'Microsoft sign-in is not connected yet. Your administrator needs to register Organic Growth in Microsoft Entra ID before you can sign in. You can explore the sample dashboard below.';
});
