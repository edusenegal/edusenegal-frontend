/* eslint-disable */
// Service worker FCM — notifications reçues quand l'onglet est fermé ou en
// arrière-plan. La config Firebase ci-dessous est PUBLIQUE (aucun secret) :
// remplacez chaque valeur par celle de VOTRE projet Firebase — les mêmes que
// les variables VITE_FIREBASE_* du build. Sans cela, le push reste inactif.
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDQElsqV-PF76qIJq8Nn7OC5tC8fYVoHW4',
  authDomain: 'edusenegal-69caa.firebaseapp.com',
  projectId: 'edusenegal-69caa',
  messagingSenderId: '871326558240',
  appId: '1:871326558240:web:11c2ab259efcf5e8487445',
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage(function (payload) {
  var n = payload.notification || {};
  self.registration.showNotification(n.title || 'EduSénégal', {
    body: n.body || '',
    icon: '/favicon.ico',
    data: payload.data || {},
  });
});
